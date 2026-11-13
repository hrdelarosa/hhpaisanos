import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import {
  asignaciones,
  auditoria,
  modulosAtencion,
  observadores,
  operativos,
  recibosAsistencia,
  registrosAsistencia,
  type AttendanceResult,
} from '../../database/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import { normalizeMark, type PersonalMark } from './attendance-input.js';
import {
  attendancePolicyVersion,
  instantMicros,
  localDate,
  receivedAt,
  timingFlags,
} from './attendance-time.js';
import { authorizePersonalAttendance, hasAdministrativeLink } from './attendance-access.js';

type Transaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];
const operation = 'attendance.capture-own';
const policyVersion = attendancePolicyVersion;
export type AttendanceResources = {
  operative?: typeof operativos.$inferSelect;
  observer?: typeof observadores.$inferSelect;
  module?: typeof modulosAtencion.$inferSelect;
  assignment?: typeof asignaciones.$inferSelect;
};

/** Internal only: callers must pass the authenticated request boundary timestamp. */
@Injectable()
export class AttendancePersistence {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    try {
      return await this.database.db.transaction(work);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const driver = error instanceof Error && error.cause ? error.cause : error;
      if (
        typeof driver === 'object' &&
        driver !== null &&
        'code' in driver &&
        ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ER_DUP_ENTRY'].includes(String(driver.code))
      )
        throw new ConflictException(
          'Concurrent attendance operation; reload and retry (personal capture uses the same key)',
        );
      // Driver errors include SQL parameters, including GPS. Never expose or log them.
      throw new InternalServerErrorException('Attendance persistence failed');
    }
  }

  async lockAssignment(tx: Transaction, id: string): Promise<AttendanceResources> {
    const [reference] = await tx.select().from(asignaciones).where(eq(asignaciones.id, id));
    if (!reference) return {};
    // Shared by personal capture and administrative mutations, matching scheduling.
    const [operative] = await tx
      .select()
      .from(operativos)
      .where(eq(operativos.id, reference.operativoId))
      .for('share');
    const [observer] = await tx
      .select()
      .from(observadores)
      .where(eq(observadores.id, reference.observadorId))
      .for('update');
    const [module] = await tx
      .select()
      .from(modulosAtencion)
      .where(eq(modulosAtencion.id, reference.moduloId))
      .for('share');
    const [assignment] = await tx
      .select()
      .from(asignaciones)
      .where(eq(asignaciones.id, id))
      .for('update');
    return { operative, observer, module, assignment };
  }

  async writeAudit(
    tx: Transaction,
    context: AuthContext,
    id: string,
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown>,
    reason: string | null = null,
  ) {
    // Callers supply decision/provenance metadata only, never precise location or receipt payloads.
    await tx.insert(auditoria).values({
      usuarioId: context.user.id,
      sesionId: context.sessionId,
      tipoEntidad: 'registros_asistencia',
      entidadId: id,
      accion: action,
      canal: 'web',
      valoresAnteriores: before,
      valoresNuevos: after,
      motivo: reason,
    });
  }

  private async authorize(tx: Transaction, context: AuthContext) {
    return authorizePersonalAttendance(tx, this.auth, context, 'attendance:capture-own');
  }

  async establish(
    context: AuthContext,
    key: string,
    input: PersonalMark,
    boundaryTimestamp: string,
  ): Promise<string> {
    if (typeof key !== 'string' || !/^[!-~]{1,128}$/.test(key))
      throw new BadRequestException('Invalid idempotency key');
    const content = normalizeMark(input);
    try {
      instantMicros(boundaryTimestamp);
      if (!boundaryTimestamp.endsWith('000')) throw new Error('Not measured milliseconds');
    } catch {
      throw new BadRequestException('Invalid request boundary timestamp');
    }
    return this.transaction(async (tx) => {
      const current = await this.authorize(tx, context);
      // The unique index is the authority even when no receipt existed at the first read.
      await tx
        .insert(recibosAsistencia)
        .values({
          usuarioId: current.user.id,
          sesionId: current.sessionId,
          operacion: operation,
          clave: key,
          recibidoEn: boundaryTimestamp,
          fechaLocal: localDate(boundaryTimestamp),
          contenido: content,
        })
        .onDuplicateKeyUpdate({ set: { id: sql`${recibosAsistencia.id}` } });
      const [receipt] = await tx
        .select()
        .from(recibosAsistencia)
        .where(
          and(
            eq(recibosAsistencia.usuarioId, current.user.id),
            eq(recibosAsistencia.operacion, operation),
            eq(recibosAsistencia.clave, key),
          ),
        )
        .for('update');
      if (
        JSON.stringify(normalizeMark(receipt.contenido as PersonalMark)) !== JSON.stringify(content)
      )
        throw new ConflictException('Idempotency key content conflict');
      return receipt.id;
    });
  }

  async complete(context: AuthContext, receiptId: string): Promise<AttendanceResult> {
    return this.transaction(async (tx) => {
      const current = await this.authorize(tx, context);
      const [reference] = await tx
        .select()
        .from(recibosAsistencia)
        .where(
          and(
            eq(recibosAsistencia.id, receiptId),
            eq(recibosAsistencia.usuarioId, current.user.id),
            eq(recibosAsistencia.operacion, operation),
          ),
        );
      if (!reference) throw new NotFoundException('Receipt not found');
      const content = normalizeMark(reference.contenido as PersonalMark);
      // Identity comes from the account, never from the client's assignment reference.
      const [observerReference] = await tx
        .select({ id: observadores.id })
        .from(observadores)
        .where(eq(observadores.usuarioId, current.user.id));
      const [assignmentReference] = await tx
        .select()
        .from(asignaciones)
        .where(
          and(
            eq(asignaciones.id, content.assignmentId),
            observerReference ? eq(asignaciones.observadorId, observerReference.id) : sql`FALSE`,
          ),
        );

      // Match scheduling: actor, operative SHARE, observer UPDATE, module SHARE,
      // assignment UPDATE, then receipt UPDATE. A pending receipt owns no assignment.
      const resources: AttendanceResources = assignmentReference
        ? await this.lockAssignment(tx, assignmentReference.id)
        : {};
      const { operative, observer, module, assignment } = resources;
      const [receipt] = await tx
        .select()
        .from(recibosAsistencia)
        .where(eq(recibosAsistencia.id, receiptId))
        .for('update');
      const accredited =
        observer?.activo &&
        observer.usuarioId === current.user.id &&
        (await hasAdministrativeLink(tx, observer.id, current.user.id));
      // Replay requires the same eligible identity, but does not reclassify past policy.
      if (receipt.estado !== 'pending') {
        if (!accredited) throw new ForbiddenException('Observer is not eligible');
        return receipt.resultado!;
      }
      const reject = async (
        code: 'ineligible' | 'day_changed' | 'initial_mark_exists' | 'invalid_order',
      ) => {
        const result = { code };
        await tx
          .update(recibosAsistencia)
          .set({ estado: 'rejected', resultado: result })
          .where(eq(recibosAsistencia.id, receiptId));
        return result;
      };
      if (
        !assignment ||
        !operative ||
        !observer ||
        !module ||
        !accredited ||
        operative.estado !== 'activo' ||
        operative.toleranciaMinutos === null ||
        !observer.activo ||
        observer.usuarioId !== current.user.id ||
        !module.activo ||
        assignment.canceladaEn !== null ||
        content.expectedDate < assignment.vigenteDesde ||
        content.expectedDate > assignment.vigenteHasta ||
        content.expectedDate < operative.fechaInicio ||
        content.expectedDate > operative.fechaFin
      )
        return reject('ineligible');
      if (
        receipt.fechaLocal !== content.expectedDate ||
        localDate(receivedAt(Date.now())) !== content.expectedDate
      )
        return reject('day_changed');
      const [existing] = await tx
        .select({ id: registrosAsistencia.id })
        .from(registrosAsistencia)
        .where(
          and(
            eq(registrosAsistencia.asignacionId, assignment.id),
            eq(registrosAsistencia.fechaAsistencia, content.expectedDate),
            eq(registrosAsistencia.tipo, content.type),
          ),
        )
        .limit(1)
        .for('update');
      if (existing) return reject('initial_mark_exists');
      const [counterpart] = await tx
        .select({ time: registrosAsistencia.registradoEn, state: registrosAsistencia.estado })
        .from(registrosAsistencia)
        .where(
          and(
            eq(registrosAsistencia.asignacionId, assignment.id),
            eq(registrosAsistencia.fechaAsistencia, content.expectedDate),
            eq(registrosAsistencia.tipo, content.type === 'entrada' ? 'salida' : 'entrada'),
            eq(registrosAsistencia.vigente, 1),
          ),
        )
        .for('update');
      if (
        content.type === 'entrada'
          ? Boolean(counterpart)
          : !counterpart ||
            ['rejected', 'annulled'].includes(counterpart.state) ||
            instantMicros(receipt.recibidoEn) <= instantMicros(counterpart.time)
      )
        return reject('invalid_order');
      const flags = timingFlags(
        receipt.recibidoEn,
        content.expectedDate,
        content.type,
        assignment.horaInicio,
        assignment.horaFin,
        operative.toleranciaMinutos,
      );
      const location = content.location;
      const missing = 'missingReason' in location;
      const state =
        flags.lateArrival || flags.earlyDeparture || missing
          ? 'pending_review'
          : 'accepted_automatic';
      // Last check under all resource locks, immediately before mutation. This is not a commit-time guarantee.
      if (
        receipt.fechaLocal !== content.expectedDate ||
        localDate(receivedAt(Date.now())) !== content.expectedDate
      )
        return reject('day_changed');
      const [{ id }] = await tx
        .insert(registrosAsistencia)
        .values({
          asignacionId: assignment.id,
          fechaAsistencia: content.expectedDate,
          tipo: content.type,
          registradoEn: receipt.recibidoEn,
          registradoPor: current.user.id,
          canal: 'web',
          reciboId: receipt.id,
          latitud: missing ? null : location.latitude.toFixed(6),
          longitud: missing ? null : location.longitude.toFixed(6),
          precisionM: missing ? null : location.accuracy.toFixed(6),
          motivoSinUbicacion: missing ? location.missingReason : null,
          estado: state,
          llegadaTardia: flags.lateArrival ? 1 : 0,
          salidaTemprana: flags.earlyDeparture ? 1 : 0,
          politicaVersion: policyVersion,
        })
        .$returningId();
      await this.writeAudit(tx, current, id, 'attendance.captured', null, {
        receiptId,
        assignmentId: assignment.id,
        date: content.expectedDate,
        type: content.type,
        state,
        policyVersion,
      });
      const result: AttendanceResult = { attendanceId: id, state };
      await tx
        .update(recibosAsistencia)
        .set({ estado: 'completed', resultado: result })
        .where(eq(recibosAsistencia.id, receiptId));
      return result;
    });
  }
}
