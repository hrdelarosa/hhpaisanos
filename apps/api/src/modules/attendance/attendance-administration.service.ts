import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte, or, sql } from 'drizzle-orm';
import {
  asignaciones,
  auditoria,
  modulosAtencion,
  observadores,
  operativos,
  registrosAsistencia,
} from '../../database/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import {
  authorizeAdministrativeAttendance,
  type AttendanceTransaction,
} from './attendance-access.js';
import { AttendancePersistence, type AttendanceResources } from './attendance.persistence.js';
import {
  attendancePolicyVersion,
  instantMicros,
  localDate,
  receivedAt,
  timingFlags,
} from './attendance-time.js';
import type {
  AdministrativeAttendancePageDto,
  AdministrativeAttendanceQueryDto,
  AttendanceVersionDto,
  CorrectAttendanceDto,
  ManualAttendanceDto,
  ReviewAttendanceDto,
} from './dto/attendance-administration.dto.js';

type Mark = typeof registrosAsistencia.$inferSelect;
const projection = {
  id: registrosAsistencia.id,
  assignmentId: asignaciones.id,
  date: registrosAsistencia.fechaAsistencia,
  type: registrosAsistencia.tipo,
  version: registrosAsistencia.version,
  current: registrosAsistencia.vigente,
  officialTimestamp: registrosAsistencia.registradoEn,
  reviewStatus: registrosAsistencia.estado,
  policyVersion: registrosAsistencia.politicaVersion,
  channel: registrosAsistencia.canal,
  observerId: observadores.id,
  observerName: sql<string>`CONCAT(${observadores.nombres}, ' ', ${observadores.apellidos})`,
  operativeId: operativos.id,
  operativeName: operativos.nombre,
  moduleId: modulosAtencion.id,
  moduleName: modulosAtencion.nombre,
  startTime: asignaciones.horaInicio,
  endTime: asignaciones.horaFin,
  late: registrosAsistencia.llegadaTardia,
  early: registrosAsistencia.salidaTemprana,
  missingReason: registrosAsistencia.motivoSinUbicacion,
};
const iso = (value: string) => value.replace(' ', 'T') + 'Z';
const utc = (value: string) => value.replace('T', ' ').slice(0, -1);

@Injectable()
export class AttendanceAdministrationService {
  constructor(
    private readonly auth: AuthService,
    private readonly persistence: AttendancePersistence,
  ) {}

  private query(tx: AttendanceTransaction) {
    return tx
      .select(projection)
      .from(registrosAsistencia)
      .innerJoin(asignaciones, eq(asignaciones.id, registrosAsistencia.asignacionId))
      .innerJoin(observadores, eq(observadores.id, asignaciones.observadorId))
      .innerJoin(operativos, eq(operativos.id, asignaciones.operativoId))
      .innerJoin(modulosAtencion, eq(modulosAtencion.id, asignaciones.moduloId));
  }

  private async present(
    tx: AttendanceTransaction,
    items: Awaited<ReturnType<AttendanceAdministrationService['query']>>,
  ) {
    if (!items.length) return [];
    const related = await tx
      .select({
        assignmentId: registrosAsistencia.asignacionId,
        date: registrosAsistencia.fechaAsistencia,
        type: registrosAsistencia.tipo,
      })
      .from(registrosAsistencia)
      .where(
        and(
          eq(registrosAsistencia.vigente, 1),
          or(
            ...items.map((item) =>
              and(
                eq(registrosAsistencia.asignacionId, item.assignmentId),
                eq(registrosAsistencia.fechaAsistencia, item.date),
              ),
            ),
          ),
        ),
      );
    return items.map(({ late, early, missingReason, ...item }) => {
      const daily = related.filter(
        (mark) => mark.assignmentId === item.assignmentId && mark.date === item.date,
      );
      const entry = daily.some((mark) => mark.type === 'entrada'),
        exit = daily.some((mark) => mark.type === 'salida');
      return {
        ...item,
        current: item.current === 1,
        officialTimestamp: iso(item.officialTimestamp),
        completeness: entry
          ? exit
            ? 'complete'
            : 'check_in_only'
          : exit
            ? 'check_out_only'
            : 'none',
        anomalies: [
          ...(late ? ['late_arrival'] : []),
          ...(early ? ['early_departure'] : []),
          ...(missingReason ? ['missing_location'] : []),
        ],
        locationEvidence: missingReason
          ? { status: 'missing', reason: missingReason }
          : { status: 'provided_unverified' },
      };
    });
  }

  async list(context: AuthContext, query: AdministrativeAttendanceQueryDto) {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException('Invalid date interval');
    return this.persistence.transaction(async (tx) => {
      await authorizeAdministrativeAttendance(tx, this.auth, context, 'attendance:read');
      const where = and(
        eq(registrosAsistencia.vigente, 1),
        query.operativeId ? eq(asignaciones.operativoId, query.operativeId) : undefined,
        query.moduleId ? eq(asignaciones.moduloId, query.moduleId) : undefined,
        query.observerId ? eq(asignaciones.observadorId, query.observerId) : undefined,
        query.from ? gte(registrosAsistencia.fechaAsistencia, query.from) : undefined,
        query.to ? lte(registrosAsistencia.fechaAsistencia, query.to) : undefined,
        query.reviewStatus ? eq(registrosAsistencia.estado, query.reviewStatus) : undefined,
        query.anomaly === 'late_arrival' ? eq(registrosAsistencia.llegadaTardia, 1) : undefined,
        query.anomaly === 'early_departure' ? eq(registrosAsistencia.salidaTemprana, 1) : undefined,
        query.anomaly === 'missing_location'
          ? isNotNull(registrosAsistencia.motivoSinUbicacion)
          : undefined,
      );
      const [{ total }] = await tx
        .select({ total: count() })
        .from(registrosAsistencia)
        .innerJoin(asignaciones, eq(asignaciones.id, registrosAsistencia.asignacionId))
        .where(where);
      const rows = await this.query(tx)
        .where(where)
        .orderBy(
          desc(registrosAsistencia.fechaAsistencia),
          asc(registrosAsistencia.asignacionId),
          asc(registrosAsistencia.tipo),
          asc(registrosAsistencia.id),
        )
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
      return { items: await this.present(tx, rows), total, page: query.page, limit: query.limit };
    });
  }

  async detail(context: AuthContext, id: string) {
    return this.persistence.transaction(async (tx) => {
      await authorizeAdministrativeAttendance(tx, this.auth, context, 'attendance:read');
      const rows = await this.query(tx).where(eq(registrosAsistencia.id, id));
      if (!rows.length) throw new NotFoundException('Attendance not found');
      const [mark] = await tx
        .select()
        .from(registrosAsistencia)
        .where(eq(registrosAsistencia.id, id));
      const [original] = await tx
        .select({ time: registrosAsistencia.registradoEn })
        .from(registrosAsistencia)
        .where(
          and(
            eq(registrosAsistencia.asignacionId, mark.asignacionId),
            eq(registrosAsistencia.fechaAsistencia, mark.fechaAsistencia),
            eq(registrosAsistencia.tipo, mark.tipo),
            eq(registrosAsistencia.version, 1),
          ),
        );
      const [result] = await this.present(tx, rows);
      return {
        ...result,
        originalEventTimestamp: iso(original.time),
        predecessorId: mark.anteriorId,
        captureActorId: mark.registradoPor,
        manualReason: mark.motivoCapturaManual,
        correctionReason: mark.motivoCorreccion,
        decision: {
          actorId: mark.revisadoPor,
          timestamp: mark.revisadoEn ? iso(mark.revisadoEn) : null,
          reason: mark.motivoDecision,
        },
        // Precise evidence is only selected into this explicit administrative detail response.
        locationEvidence: mark.motivoSinUbicacion
          ? { status: 'missing', reason: mark.motivoSinUbicacion }
          : {
              status: 'provided_unverified',
              latitude: Number(mark.latitud),
              longitude: Number(mark.longitud),
              accuracy: Number(mark.precisionM),
            },
      };
    });
  }

  async history(context: AuthContext, id: string, query: AdministrativeAttendancePageDto) {
    return this.persistence.transaction(async (tx) => {
      await authorizeAdministrativeAttendance(tx, this.auth, context, 'attendance:read');
      const [reference] = await tx
        .select()
        .from(registrosAsistencia)
        .where(eq(registrosAsistencia.id, id));
      if (!reference) throw new NotFoundException('Attendance not found');
      const where = and(
        eq(registrosAsistencia.asignacionId, reference.asignacionId),
        eq(registrosAsistencia.fechaAsistencia, reference.fechaAsistencia),
        eq(registrosAsistencia.tipo, reference.tipo),
      );
      const [{ total }] = await tx
        .select({ total: count() })
        .from(registrosAsistencia)
        .where(where);
      const versions = await this.query(tx)
        .where(where)
        .orderBy(asc(registrosAsistencia.version))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
      const events = versions.length
        ? await tx
            .select({
              entityId: auditoria.entidadId,
              action: auditoria.accion,
              actorId: auditoria.usuarioId,
              reason: auditoria.motivo,
              timestamp: auditoria.creadoEn,
              previousStatus: sql<
                string | null
              >`JSON_UNQUOTE(JSON_EXTRACT(${auditoria.valoresAnteriores}, '$.state'))`,
              reviewStatus: sql<
                string | null
              >`JSON_UNQUOTE(JSON_EXTRACT(${auditoria.valoresNuevos}, '$.state'))`,
            })
            .from(auditoria)
            .where(
              and(
                eq(auditoria.tipoEntidad, 'registros_asistencia'),
                inArray(
                  auditoria.entidadId,
                  versions.map((row) => row.id),
                ),
              ),
            )
            .orderBy(asc(auditoria.creadoEn), asc(auditoria.id))
            .limit(query.limit * 4)
        : [];
      const items = (await this.present(tx, versions)).map((item) => ({
        ...item,
        events: events
          .filter((event) => event.entityId === item.id)
          .map(({ entityId: _entityId, ...event }) => ({
            ...event,
            timestamp: iso(event.timestamp),
          })),
      }));
      return { items, total, page: query.page, limit: query.limit };
    });
  }

  private requireHistoricalEvent(resources: AttendanceResources, date: string, time: string) {
    const { assignment, operative, observer, module } = resources;
    if (!assignment || !operative || !observer || !module)
      throw new NotFoundException('Assignment not found');
    if (
      assignment.canceladaEn !== null ||
      !['activo', 'cerrado'].includes(operative.estado) ||
      operative.toleranciaMinutos === null ||
      date < assignment.vigenteDesde ||
      date > assignment.vigenteHasta ||
      date < operative.fechaInicio ||
      date > operative.fechaFin ||
      localDate(time) !== date ||
      instantMicros(time) > instantMicros(receivedAt(Date.now()))
    )
      throw new ConflictException('Invalid historical attendance context');
    return { assignment, operative, observer, module };
  }

  private async requireOrder(
    tx: AttendanceTransaction,
    assignmentId: string,
    date: string,
    type: 'entrada' | 'salida',
    time: string,
  ) {
    const [other] = await tx
      .select()
      .from(registrosAsistencia)
      .where(
        and(
          eq(registrosAsistencia.asignacionId, assignmentId),
          eq(registrosAsistencia.fechaAsistencia, date),
          eq(registrosAsistencia.tipo, type === 'entrada' ? 'salida' : 'entrada'),
          eq(registrosAsistencia.vigente, 1),
        ),
      )
      .for('update');
    // Historical administrative capture may fill either half first; never fabricate the other.
    if (
      other &&
      !['rejected', 'annulled'].includes(other.estado) &&
      (type === 'entrada'
        ? instantMicros(time) >= instantMicros(other.registradoEn)
        : instantMicros(time) <= instantMicros(other.registradoEn))
    )
      throw new ConflictException('Attendance times are out of order');
  }

  private facts(
    resources: ReturnType<AttendanceAdministrationService['requireHistoricalEvent']>,
    date: string,
    type: 'entrada' | 'salida',
    time: string,
  ) {
    return timingFlags(
      time,
      date,
      type,
      resources.assignment.horaInicio,
      resources.assignment.horaFin,
      resources.operative.toleranciaMinutos!,
    );
  }

  private metadata(mark: Mark) {
    return {
      id: mark.id,
      assignmentId: mark.asignacionId,
      date: mark.fechaAsistencia,
      type: mark.tipo,
      version: mark.version,
      state: mark.estado,
      current: mark.vigente === 1,
      policyVersion: mark.politicaVersion,
      officialTimestamp: iso(mark.registradoEn),
      reviewedBy: mark.revisadoPor,
      reviewedAt: mark.revisadoEn ? iso(mark.revisadoEn) : null,
      decisionReason: mark.motivoDecision,
    };
  }

  async manual(context: AuthContext, input: ManualAttendanceDto) {
    return this.persistence.transaction(async (tx) => {
      const current = await authorizeAdministrativeAttendance(
        tx,
        this.auth,
        context,
        'attendance:capture-manual',
      );
      const time = utc(input.officialTimestamp);
      const resources = this.requireHistoricalEvent(
        await this.persistence.lockAssignment(tx, input.assignmentId),
        input.date,
        time,
      );
      if (resources.observer.id !== input.observerId)
        throw new ConflictException('Observer does not match historical assignment');
      const [existing] = await tx
        .select({ id: registrosAsistencia.id })
        .from(registrosAsistencia)
        .where(
          and(
            eq(registrosAsistencia.asignacionId, input.assignmentId),
            eq(registrosAsistencia.fechaAsistencia, input.date),
            eq(registrosAsistencia.tipo, input.type),
          ),
        )
        .limit(1)
        .for('update');
      if (existing) throw new ConflictException('Initial attendance mark already exists');
      await this.requireOrder(tx, input.assignmentId, input.date, input.type, time);
      const flags = this.facts(resources, input.date, input.type, time);
      const [{ id }] = await tx
        .insert(registrosAsistencia)
        .values({
          asignacionId: input.assignmentId,
          fechaAsistencia: input.date,
          tipo: input.type,
          registradoEn: time,
          registradoPor: current.user.id,
          canal: 'manual',
          motivoCapturaManual: input.reason,
          motivoSinUbicacion: input.missingLocationReason,
          estado: 'accepted_administrative',
          politicaVersion: attendancePolicyVersion,
          llegadaTardia: flags.lateArrival ? 1 : 0,
          salidaTemprana: flags.earlyDeparture ? 1 : 0,
          revisadoPor: current.user.id,
          revisadoEn: sql`UTC_TIMESTAMP(6)`,
          motivoDecision: input.reason,
        })
        .$returningId();
      await this.persistence.writeAudit(
        tx,
        current,
        id,
        'attendance.captured-manual',
        null,
        {
          assignmentId: input.assignmentId,
          date: input.date,
          type: input.type,
          version: 1,
          state: 'accepted_administrative',
          policyVersion: attendancePolicyVersion,
        },
        input.reason,
      );
      return { id, version: 1, reviewStatus: 'accepted_administrative' };
    });
  }

  private async lockedMark(tx: AttendanceTransaction, id: string, expectedVersion: number) {
    const [reference] = await tx
      .select({ assignmentId: registrosAsistencia.asignacionId })
      .from(registrosAsistencia)
      .where(eq(registrosAsistencia.id, id));
    if (!reference) throw new NotFoundException('Attendance not found');
    const resources = await this.persistence.lockAssignment(tx, reference.assignmentId);
    const [mark] = await tx
      .select()
      .from(registrosAsistencia)
      .where(eq(registrosAsistencia.id, id))
      .for('update');
    if (mark.vigente !== 1 || mark.version !== expectedVersion)
      throw new ConflictException('Stale attendance version');
    return { mark, resources };
  }

  async review(context: AuthContext, id: string, input: ReviewAttendanceDto) {
    return this.persistence.transaction(async (tx) => {
      const current = await authorizeAdministrativeAttendance(
        tx,
        this.auth,
        context,
        'attendance:review',
      );
      const { mark } = await this.lockedMark(tx, id, input.expectedVersion);
      if (mark.estado !== 'pending_review')
        throw new ConflictException('Only pending attendance can be reviewed');
      const state = input.decision === 'accept' ? 'accepted_administrative' : 'rejected';
      await tx
        .update(registrosAsistencia)
        .set({
          estado: state,
          revisadoPor: current.user.id,
          revisadoEn: sql`UTC_TIMESTAMP(6)`,
          motivoDecision: input.reason,
        })
        .where(eq(registrosAsistencia.id, id));
      const [reviewed] = await tx
        .select()
        .from(registrosAsistencia)
        .where(eq(registrosAsistencia.id, id));
      await this.persistence.writeAudit(
        tx,
        current,
        id,
        'attendance.reviewed',
        this.metadata(mark),
        this.metadata(reviewed),
        input.reason,
      );
      return { id, version: mark.version, reviewStatus: state };
    });
  }

  async correct(context: AuthContext, id: string, input: CorrectAttendanceDto) {
    return this.persistence.transaction(async (tx) => {
      const current = await authorizeAdministrativeAttendance(
        tx,
        this.auth,
        context,
        'attendance:correct',
      );
      const { mark, resources } = await this.lockedMark(tx, id, input.expectedVersion);
      if (mark.estado === 'annulled')
        throw new ConflictException('Annulled attendance cannot be recreated');
      if (mark.version === 4294967295) throw new ConflictException('Attendance version exhausted');
      if (mark.politicaVersion !== attendancePolicyVersion)
        throw new ConflictException('Unsupported historical attendance policy');
      const time = utc(input.officialTimestamp),
        historical = this.requireHistoricalEvent(resources, mark.fechaAsistencia, time);
      await this.requireOrder(tx, mark.asignacionId, mark.fechaAsistencia, mark.tipo, time);
      const flags = this.facts(historical, mark.fechaAsistencia, mark.tipo, time);
      await tx
        .update(registrosAsistencia)
        .set({ vigente: null })
        .where(eq(registrosAsistencia.id, id));
      const [{ id: nextId }] = await tx
        .insert(registrosAsistencia)
        .values({
          asignacionId: mark.asignacionId,
          fechaAsistencia: mark.fechaAsistencia,
          tipo: mark.tipo,
          version: mark.version + 1,
          registradoEn: time,
          registradoPor: mark.registradoPor,
          canal: mark.canal,
          anteriorId: id,
          latitud: mark.latitud,
          longitud: mark.longitud,
          precisionM: mark.precisionM,
          motivoSinUbicacion: mark.motivoSinUbicacion,
          estado: 'pending_review',
          politicaVersion: mark.politicaVersion,
          motivoCapturaManual: mark.motivoCapturaManual,
          motivoCorreccion: input.reason,
          llegadaTardia: flags.lateArrival ? 1 : 0,
          salidaTemprana: flags.earlyDeparture ? 1 : 0,
        })
        .$returningId();
      await this.persistence.writeAudit(
        tx,
        current,
        nextId,
        'attendance.corrected',
        this.metadata(mark),
        {
          id: nextId,
          predecessorId: id,
          version: mark.version + 1,
          state: 'pending_review',
          policyVersion: mark.politicaVersion,
        },
        input.reason,
      );
      return { id: nextId, version: mark.version + 1, reviewStatus: 'pending_review' };
    });
  }

  async annul(context: AuthContext, id: string, input: AttendanceVersionDto) {
    return this.persistence.transaction(async (tx) => {
      const current = await authorizeAdministrativeAttendance(
        tx,
        this.auth,
        context,
        'attendance:annul',
      );
      const { mark } = await this.lockedMark(tx, id, input.expectedVersion);
      if (mark.estado === 'annulled') throw new ConflictException('Attendance is already annulled');
      await tx
        .update(registrosAsistencia)
        .set({
          estado: 'annulled',
          revisadoPor: current.user.id,
          revisadoEn: sql`UTC_TIMESTAMP(6)`,
          motivoDecision: input.reason,
        })
        .where(eq(registrosAsistencia.id, id));
      const [annulled] = await tx
        .select()
        .from(registrosAsistencia)
        .where(eq(registrosAsistencia.id, id));
      await this.persistence.writeAudit(
        tx,
        current,
        id,
        'attendance.annulled',
        this.metadata(mark),
        this.metadata(annulled),
        input.reason,
      );
      return { id, version: mark.version, reviewStatus: 'annulled' };
    });
  }
}
