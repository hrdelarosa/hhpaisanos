import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { and, asc, count, desc, eq, gte, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import {
  asignaciones,
  modulosAtencion,
  observadores,
  operativos,
  registrosAsistencia,
} from '../../database/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import {
  authorizePersonalAttendance,
  hasAdministrativeLink,
  type AttendanceTransaction,
} from './attendance-access.js';
import { AttendancePersistence } from './attendance.persistence.js';
import { localDate } from './attendance-time.js';
import type { AttendanceHistoryQueryDto } from './dto/attendance-history-query.dto.js';
import type { CaptureAttendanceDto } from './dto/capture-attendance.dto.js';

const assignmentProjection = {
  assignmentId: asignaciones.id,
  operativeId: operativos.id,
  operativeName: operativos.nombre,
  moduleId: modulosAtencion.id,
  moduleName: modulosAtencion.nombre,
  startTime: asignaciones.horaInicio,
  endTime: asignaciones.horaFin,
  arrivalToleranceMinutes: operativos.toleranciaMinutos,
};
const markProjection = {
  id: registrosAsistencia.id,
  assignmentId: registrosAsistencia.asignacionId,
  date: registrosAsistencia.fechaAsistencia,
  type: registrosAsistencia.tipo,
  version: registrosAsistencia.version,
  officialTimestamp: sql<string>`CONCAT(REPLACE(${registrosAsistencia.registradoEn}, ' ', 'T'), 'Z')`,
  reviewStatus: registrosAsistencia.estado,
  late: registrosAsistencia.llegadaTardia,
  early: registrosAsistencia.salidaTemprana,
  missingReason: registrosAsistencia.motivoSinUbicacion,
};

@Injectable()
export class AttendanceService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
    private readonly persistence: AttendancePersistence,
  ) {}

  async capture(
    context: AuthContext,
    key: string,
    input: CaptureAttendanceDto,
    type: 'entrada' | 'salida',
    timestamp: string,
  ) {
    const receipt = await this.persistence.establish(
      context,
      key,
      {
        assignmentId: input.assignmentId,
        expectedDate: input.expectedDate,
        location: input.location,
        type,
      },
      timestamp,
    );
    const result = await this.persistence.complete(context, receipt);
    if ('code' in result) {
      if (result.code === 'ineligible')
        throw new ForbiddenException({
          code: result.code,
          message: 'Attendance capture is not eligible',
        });
      throw new ConflictException({
        code: result.code,
        message: 'Attendance request conflicts with the daily context or mark order',
      });
    }
    return result;
  }

  private async ownObserver(tx: AttendanceTransaction, context: AuthContext) {
    const current = await authorizePersonalAttendance(
      tx,
      this.auth,
      context,
      'attendance:read-own',
    );
    const [observer] = await tx
      .select({ id: observadores.id, active: observadores.activo })
      .from(observadores)
      .where(eq(observadores.usuarioId, current.user.id))
      .for('share');
    if (!observer?.active || !(await hasAdministrativeLink(tx, observer.id, current.user.id)))
      throw new ForbiddenException('Observer is not eligible');
    return observer.id;
  }

  async today(context: AuthContext, timestamp: string) {
    const date = localDate(timestamp);
    return this.database.db.transaction(async (tx) => {
      const observerId = await this.ownObserver(tx, context);
      const assignments = await tx
        .select(assignmentProjection)
        .from(asignaciones)
        .innerJoin(operativos, eq(operativos.id, asignaciones.operativoId))
        .innerJoin(modulosAtencion, eq(modulosAtencion.id, asignaciones.moduloId))
        .where(
          and(
            eq(asignaciones.observadorId, observerId),
            isNull(asignaciones.canceladaEn),
            lte(asignaciones.vigenteDesde, date),
            gte(asignaciones.vigenteHasta, date),
            eq(operativos.estado, 'activo'),
            isNotNull(operativos.toleranciaMinutos),
            lte(operativos.fechaInicio, date),
            gte(operativos.fechaFin, date),
            eq(modulosAtencion.activo, true),
          ),
        )
        .orderBy(asc(asignaciones.id));
      const groups = assignments.map((assignment) => ({ ...assignment, date }));
      return {
        date,
        timeZone: 'America/Mexico_City',
        assignments: await this.withMarks(tx, groups),
      };
    });
  }

  async history(context: AuthContext, query: AttendanceHistoryQueryDto) {
    if (query.from && query.to && query.from > query.to)
      throw new BadRequestException('Invalid date interval');
    return this.database.db.transaction(async (tx) => {
      const observerId = await this.ownObserver(tx, context);
      const where = and(
        eq(asignaciones.observadorId, observerId),
        eq(registrosAsistencia.vigente, 1),
        query.from ? gte(registrosAsistencia.fechaAsistencia, query.from) : undefined,
        query.to ? lte(registrosAsistencia.fechaAsistencia, query.to) : undefined,
      );
      const days = tx
        .select({
          assignmentId: registrosAsistencia.asignacionId,
          date: registrosAsistencia.fechaAsistencia,
        })
        .from(registrosAsistencia)
        .innerJoin(asignaciones, eq(asignaciones.id, registrosAsistencia.asignacionId))
        .where(where)
        .groupBy(registrosAsistencia.asignacionId, registrosAsistencia.fechaAsistencia)
        .as('attendance_days');
      const [{ total }] = await tx.select({ total: count() }).from(days);
      const groups = await tx
        .select({ ...assignmentProjection, date: registrosAsistencia.fechaAsistencia })
        .from(registrosAsistencia)
        .innerJoin(asignaciones, eq(asignaciones.id, registrosAsistencia.asignacionId))
        .innerJoin(operativos, eq(operativos.id, asignaciones.operativoId))
        .innerJoin(modulosAtencion, eq(modulosAtencion.id, asignaciones.moduloId))
        .where(where)
        .groupBy(asignaciones.id, registrosAsistencia.fechaAsistencia)
        .orderBy(desc(registrosAsistencia.fechaAsistencia), asc(asignaciones.id))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit);
      return {
        items: await this.withMarks(tx, groups),
        total,
        page: query.page,
        limit: query.limit,
      };
    });
  }

  private async withMarks(
    tx: AttendanceTransaction,
    groups: { assignmentId: string; date: string }[],
  ) {
    if (!groups.length) return [];
    // Fetch only projected evidence status, never coordinates or receipt content.
    const marks = await tx
      .select(markProjection)
      .from(registrosAsistencia)
      .where(
        and(
          eq(registrosAsistencia.vigente, 1),
          or(
            ...groups.map((group) =>
              and(
                eq(registrosAsistencia.asignacionId, group.assignmentId),
                eq(registrosAsistencia.fechaAsistencia, group.date),
              ),
            ),
          ),
        ),
      );
    return groups.map((group) => {
      const mark = (type: 'entrada' | 'salida') => {
        const row = marks.find(
          (m) => m.assignmentId === group.assignmentId && m.date === group.date && m.type === type,
        );
        if (!row) return null;
        return {
          id: row.id,
          version: row.version,
          officialTimestamp: row.officialTimestamp,
          reviewStatus: row.reviewStatus,
          anomalies: [
            ...(row.late ? ['late_arrival'] : []),
            ...(row.early ? ['early_departure'] : []),
            ...(row.missingReason ? ['missing_location'] : []),
          ],
          locationEvidence: row.missingReason
            ? { status: 'missing', reason: row.missingReason }
            : { status: 'provided_unverified' },
        };
      };
      const checkIn = mark('entrada'),
        checkOut = mark('salida');
      return {
        ...group,
        completeness: checkIn
          ? checkOut
            ? 'complete'
            : 'check_in_only'
          : checkOut
            ? 'check_out_only'
            : 'none',
        checkIn,
        checkOut,
      };
    });
  }
}
