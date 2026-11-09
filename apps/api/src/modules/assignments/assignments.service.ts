import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, gte, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import {
  asignaciones,
  auditoria,
  modulosAtencion,
  observadores,
  operativos,
} from '../../database/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import type { CancelAssignmentDto } from './dto/cancel-assignment.dto.js';
import type { ChangeAssignmentDto } from './dto/change-assignment.dto.js';
import type { CreateAssignmentDto } from './dto/create-assignment.dto.js';
import type { ListAssignmentsQueryDto } from './dto/list-assignments-query.dto.js';
import type { TerminateAssignmentDto } from './dto/terminate-assignment.dto.js';

type Transaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];
type Assignment = typeof asignaciones.$inferSelect;
const projection = {
  id: asignaciones.id,
  operativeId: asignaciones.operativoId,
  observerId: asignaciones.observadorId,
  attentionModuleId: asignaciones.moduloId,
  validFrom: asignaciones.vigenteDesde,
  validTo: asignaciones.vigenteHasta,
  startTime: asignaciones.horaInicio,
  endTime: asignaciones.horaFin,
  cancelledAt: sql<string | null>`CONCAT(REPLACE(${asignaciones.canceladaEn}, ' ', 'T'), 'Z')`,
  version: asignaciones.versionBloqueo,
  createdBy: asignaciones.creadoPor,
  createdAt: sql<string>`CONCAT(REPLACE(${asignaciones.creadoEn}, ' ', 'T'), 'Z')`,
  updatedAt: sql<string>`CONCAT(REPLACE(${asignaciones.actualizadoEn}, ' ', 'T'), 'Z')`,
};

const civilDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function previousDate(date: string): string {
  // Calendar arithmetic only: the shift date is not an attendance timestamp.
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  private async mutate<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    try {
      return await this.database.db.transaction(work);
    } catch (error) {
      const driver = error instanceof Error && error.cause ? error.cause : error;
      if (typeof driver === 'object' && driver !== null && 'code' in driver) {
        if (driver.code === 'ER_LOCK_DEADLOCK' || driver.code === 'ER_LOCK_WAIT_TIMEOUT')
          throw new ConflictException('Concurrent assignment operation; reload and retry');
        if (
          driver.code === 'ER_DUP_ENTRY' &&
          'sqlMessage' in driver &&
          typeof driver.sqlMessage === 'string' &&
          driver.sqlMessage.includes('asignaciones_activa_unique')
        )
          throw new ConflictException('Assignment already exists');
      }
      throw error;
    }
  }

  private async authorize(tx: Transaction, context: AuthContext, permission: string) {
    const current = await this.auth.requireCurrentContext(tx, context);
    if (!current.user.permissions.includes(permission))
      throw new ForbiddenException('Insufficient permissions');
    return current;
  }

  private async lockResources(
    tx: Transaction,
    operativeId: string,
    observerId: string,
    moduleIds: string[],
  ) {
    const [operative] = await tx
      .select()
      .from(operativos)
      .where(eq(operativos.id, operativeId))
      .for('share');
    if (!operative) throw new NotFoundException('Operative not found');
    // This row serializes all scheduling for the observer, including empty calendars.
    const [observer] = await tx
      .select({ active: observadores.activo })
      .from(observadores)
      .where(eq(observadores.id, observerId))
      .for('update');
    if (!observer) throw new NotFoundException('Observer not found');
    const modules = new Map<string, boolean>();
    for (const id of [...new Set(moduleIds)].sort()) {
      const [module] = await tx
        .select({ active: modulosAtencion.activo })
        .from(modulosAtencion)
        .where(eq(modulosAtencion.id, id))
        .for('share');
      if (!module) throw new NotFoundException('Attention module not found');
      modules.set(id, module.active);
    }
    return { operative, observer, modules };
  }

  private validateSchedule(from: string, to: string, start: string, end: string) {
    if (from > to || start >= end) throw new BadRequestException('Invalid assignment interval');
  }

  private requireOpenOperative(operative: typeof operativos.$inferSelect) {
    if (operative.estado !== 'borrador' && operative.estado !== 'activo')
      throw new ConflictException('Operative does not permit scheduling changes');
  }

  private async requireAvailable(
    tx: Transaction,
    observerId: string,
    from: string,
    to: string,
    excludeId?: string,
  ) {
    const [conflict] = await tx
      .select({ id: asignaciones.id })
      .from(asignaciones)
      .where(
        and(
          eq(asignaciones.observadorId, observerId),
          isNull(asignaciones.canceladaEn),
          lte(asignaciones.vigenteDesde, to),
          gte(asignaciones.vigenteHasta, from),
          excludeId === undefined ? undefined : ne(asignaciones.id, excludeId),
        ),
      )
      .limit(1)
      .for('share');
    if (conflict) throw new ConflictException('Observer has an overlapping assignment');
  }

  private async audit(
    tx: Transaction,
    context: AuthContext,
    id: string,
    action: string,
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown>,
    reason?: string,
  ) {
    await tx.insert(auditoria).values({
      usuarioId: context.user.id,
      sesionId: context.sessionId,
      tipoEntidad: 'asignaciones',
      entidadId: id,
      accion: action,
      valoresAnteriores: before,
      valoresNuevos: after,
      motivo: reason,
      canal: 'web',
    });
  }

  private async read(tx: Transaction, id: string) {
    const [row] = await tx.select(projection).from(asignaciones).where(eq(asignaciones.id, id));
    return row;
  }

  async create(input: CreateAssignmentDto, context: AuthContext) {
    this.validateSchedule(input.validFrom, input.validTo, input.startTime, input.endTime);
    return this.mutate(async (tx) => {
      const current = await this.authorize(tx, context, 'assignments:create');
      const resources = await this.lockResources(tx, input.operativeId, input.observerId, [
        input.attentionModuleId,
      ]);
      this.requireOpenOperative(resources.operative);
      if (!resources.observer.active || !resources.modules.get(input.attentionModuleId))
        throw new ConflictException('Observer and attention module must be active');
      if (
        input.validFrom < resources.operative.fechaInicio ||
        input.validTo > resources.operative.fechaFin
      )
        throw new ConflictException('Assignment is outside operative dates');
      await this.requireAvailable(tx, input.observerId, input.validFrom, input.validTo);
      const values = {
        operativoId: input.operativeId,
        observadorId: input.observerId,
        moduloId: input.attentionModuleId,
        vigenteDesde: input.validFrom,
        vigenteHasta: input.validTo,
        horaInicio: input.startTime,
        horaFin: input.endTime,
        creadoPor: current.user.id,
      };
      const [{ id }] = await tx.insert(asignaciones).values(values).$returningId();
      await this.audit(tx, current, id, 'assignments.created', undefined, values);
      return this.read(tx, id);
    });
  }

  async list(query: ListAssignmentsQueryDto) {
    const offset = (query.page - 1) * query.limit;
    if (!Number.isSafeInteger(offset)) throw new BadRequestException('Invalid page');
    if (query.from !== undefined && query.to !== undefined && query.from > query.to)
      throw new BadRequestException('Invalid date range');
    const where = and(
      query.operativeId === undefined ? undefined : eq(asignaciones.operativoId, query.operativeId),
      query.observerId === undefined ? undefined : eq(asignaciones.observadorId, query.observerId),
      query.attentionModuleId === undefined
        ? undefined
        : eq(asignaciones.moduloId, query.attentionModuleId),
      query.from === undefined ? undefined : gte(asignaciones.vigenteHasta, query.from),
      query.to === undefined ? undefined : lte(asignaciones.vigenteDesde, query.to),
      query.applicableOn === undefined
        ? undefined
        : and(
            lte(asignaciones.vigenteDesde, query.applicableOn),
            gte(asignaciones.vigenteHasta, query.applicableOn),
            isNull(asignaciones.canceladaEn),
          ),
      query.cancelled === undefined
        ? undefined
        : query.cancelled
          ? isNotNull(asignaciones.canceladaEn)
          : isNull(asignaciones.canceladaEn),
    );
    return this.database.db.transaction(
      async (tx) => {
        const [{ total }] = await tx.select({ total: count() }).from(asignaciones).where(where);
        const items = await tx
          .select(projection)
          .from(asignaciones)
          .where(where)
          .orderBy(asc(asignaciones.vigenteDesde), asc(asignaciones.id))
          .limit(query.limit)
          .offset(offset);
        return { items, page: query.page, limit: query.limit, total };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  async detail(id: string) {
    const [row] = await this.database.db
      .select(projection)
      .from(asignaciones)
      .where(eq(asignaciones.id, id));
    if (!row) throw new NotFoundException('Assignment not found');
    return row;
  }

  async modify(
    id: string,
    input: CancelAssignmentDto | TerminateAssignmentDto | ChangeAssignmentDto,
    operation: 'change' | 'terminate' | 'cancel',
    context: AuthContext,
  ) {
    return this.mutate(async (tx) => {
      const current = await this.authorize(
        tx,
        context,
        operation === 'cancel' ? 'assignments:cancel' : 'assignments:update',
      );
      // References are immutable. Discover them first, then lock parents before the child,
      // matching Attention Modules' parent-before-assignment locking order.
      const [reference] = await tx.select().from(asignaciones).where(eq(asignaciones.id, id));
      if (!reference) throw new NotFoundException('Assignment not found');
      const change = operation === 'change' ? (input as ChangeAssignmentDto) : undefined;
      if (
        change &&
        change.attentionModuleId === undefined &&
        change.startTime === undefined &&
        change.endTime === undefined
      )
        throw new BadRequestException('No conditions supplied');
      const moduleId = change?.attentionModuleId ?? reference.moduloId;
      const resources = await this.lockResources(
        tx,
        reference.operativoId,
        reference.observadorId,
        [reference.moduloId, moduleId],
      );
      const [assignment] = await tx
        .select()
        .from(asignaciones)
        .where(eq(asignaciones.id, id))
        .for('update');
      if (assignment.versionBloqueo !== input.expectedVersion)
        throw new ConflictException('Stale assignment version');
      if (assignment.canceladaEn) {
        if (operation === 'cancel') return;
        throw new ConflictException('Assignment is cancelled');
      }
      // Evaluate civil time only after acquiring locks: a request may wait across midnight.
      const today = civilDate.format(new Date());
      if (change) return this.change(tx, current, assignment, change, resources, today);
      if (operation === 'terminate') {
        const { lastValidDate } = input as TerminateAssignmentDto;
        if (
          assignment.vigenteDesde > today ||
          lastValidDate < today ||
          lastValidDate < assignment.vigenteDesde ||
          lastValidDate > assignment.vigenteHasta
        )
          throw new ConflictException('Termination must preserve all elapsed dates');
        if (lastValidDate === assignment.vigenteHasta) return;
        this.requireOpenOperative(resources.operative);
        await this.update(tx, assignment, { vigenteHasta: lastValidDate });
        await this.audit(
          tx,
          current,
          id,
          'assignments.terminated',
          { validTo: assignment.vigenteHasta, version: assignment.versionBloqueo },
          { validTo: lastValidDate, version: assignment.versionBloqueo + 1 },
          input.reason,
        );
        return;
      }
      if (assignment.vigenteDesde <= today)
        throw new ConflictException('Started assignments must be terminated, not cancelled');
      this.requireOpenOperative(resources.operative);
      await this.update(tx, assignment, { canceladaEn: sql`UTC_TIMESTAMP(6)` });
      const cancelled = await this.read(tx, id);
      await this.audit(
        tx,
        current,
        id,
        'assignments.cancelled',
        { cancelledAt: null, version: assignment.versionBloqueo },
        { cancelledAt: cancelled.cancelledAt, version: cancelled.version },
        input.reason,
      );
    });
  }

  private async update(
    tx: Transaction,
    assignment: Assignment,
    values: { vigenteHasta?: string; canceladaEn?: ReturnType<typeof sql> },
  ) {
    if (assignment.versionBloqueo === 4294967295)
      throw new ConflictException('Assignment version exhausted');
    await tx
      .update(asignaciones)
      .set({ ...values, versionBloqueo: assignment.versionBloqueo + 1 })
      .where(eq(asignaciones.id, assignment.id));
  }

  private async change(
    tx: Transaction,
    context: AuthContext,
    assignment: Assignment,
    input: ChangeAssignmentDto,
    resources: Awaited<ReturnType<AssignmentsService['lockResources']>>,
    today: string,
  ) {
    if (
      input.effectiveFrom <= today ||
      input.effectiveFrom < assignment.vigenteDesde ||
      input.effectiveFrom > assignment.vigenteHasta
    )
      throw new ConflictException('Change must start on a future date within this period');
    const moduleId = input.attentionModuleId ?? assignment.moduloId;
    const start = input.startTime ?? assignment.horaInicio;
    const end = input.endTime ?? assignment.horaFin;
    this.validateSchedule(input.effectiveFrom, assignment.vigenteHasta, start, end);
    if (
      moduleId === assignment.moduloId &&
      start === assignment.horaInicio &&
      end === assignment.horaFin
    )
      return;
    this.requireOpenOperative(resources.operative);
    if (!resources.observer.active || !resources.modules.get(moduleId))
      throw new ConflictException('Observer and attention module must be active');
    if (
      assignment.vigenteDesde < resources.operative.fechaInicio ||
      assignment.vigenteHasta > resources.operative.fechaFin
    )
      throw new ConflictException('Assignment is outside operative dates');
    await this.requireAvailable(
      tx,
      assignment.observadorId,
      input.effectiveFrom,
      assignment.vigenteHasta,
      assignment.id,
    );
    const replaceWhole = input.effectiveFrom === assignment.vigenteDesde;
    await this.update(
      tx,
      assignment,
      replaceWhole
        ? { canceladaEn: sql`UTC_TIMESTAMP(6)` }
        : { vigenteHasta: previousDate(input.effectiveFrom) },
    );
    const [{ id }] = await tx
      .insert(asignaciones)
      .values({
        operativoId: assignment.operativoId,
        observadorId: assignment.observadorId,
        moduloId: moduleId,
        vigenteDesde: input.effectiveFrom,
        vigenteHasta: assignment.vigenteHasta,
        horaInicio: start,
        horaFin: end,
        creadoPor: context.user.id,
      })
      .$returningId();
    const previous = await this.read(tx, assignment.id);
    await this.audit(
      tx,
      context,
      assignment.id,
      'assignments.changed',
      { validTo: assignment.vigenteHasta, version: assignment.versionBloqueo, cancelledAt: null },
      {
        validTo: previous.validTo,
        version: previous.version,
        cancelledAt: previous.cancelledAt,
        replacementId: id,
      },
      input.reason,
    );
    const created = await this.read(tx, id);
    await this.audit(
      tx,
      context,
      id,
      'assignments.created',
      undefined,
      {
        previousAssignmentId: assignment.id,
        operativeId: created.operativeId,
        observerId: created.observerId,
        attentionModuleId: created.attentionModuleId,
        validFrom: created.validFrom,
        validTo: created.validTo,
        startTime: created.startTime,
        endTime: created.endTime,
      },
      input.reason,
    );
    return created;
  }
}
