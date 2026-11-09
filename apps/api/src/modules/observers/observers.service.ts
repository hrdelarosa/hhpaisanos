import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { auditoria, observadores } from '../../database/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import type { CreateObserverDto } from './dto/create-observer.dto.js';
import type { UpdateObserverDto } from './dto/update-observer.dto.js';
import type { ChangeObserverStatusDto } from './dto/change-observer-status.dto.js';
import type { ListObserversQueryDto } from './dto/list-observers-query.dto.js';

type Transaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];
const projection = {
  id: observadores.id,
  firstNames: observadores.nombres,
  lastNames: observadores.apellidos,
  phone: observadores.telefono,
  active: observadores.activo,
  userId: observadores.usuarioId,
  createdAt: observadores.creadoEn,
  updatedAt: observadores.actualizadoEn,
};

@Injectable()
export class ObserversService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  private async authorize(tx: Transaction, context: AuthContext, permission: string) {
    const current = await this.auth.requireCurrentContext(tx, context);
    if (!current.user.permissions.includes(permission))
      throw new ForbiddenException('Insufficient permissions');
    return current;
  }

  private async audit(
    tx: Transaction,
    context: AuthContext,
    id: string,
    action: string,
    reason?: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ) {
    await tx.insert(auditoria).values({
      usuarioId: context.user.id,
      sesionId: context.sessionId,
      entidadId: id,
      tipoEntidad: 'observadores',
      accion: action,
      canal: 'web',
      motivo: reason,
      valoresAnteriores: before,
      valoresNuevos: after,
    });
  }

  async create(context: AuthContext, input: CreateObserverDto) {
    return this.database.db.transaction(async (tx) => {
      const current = await this.authorize(tx, context, 'observers:create');
      const [{ id }] = await tx
        .insert(observadores)
        .values({
          nombres: input.firstNames,
          apellidos: input.lastNames,
          telefono: input.phone ?? null,
          activo: true,
        })
        .$returningId();
      await this.audit(tx, current, id, 'observers.created', undefined, undefined, {
        active: true,
      });
      const [created] = await tx
        .select(projection)
        .from(observadores)
        .where(eq(observadores.id, id));
      return created;
    });
  }

  async list(query: ListObserversQueryDto) {
    const where = and(
      query.active === undefined ? undefined : eq(observadores.activo, query.active),
      query.linked === undefined
        ? undefined
        : query.linked
          ? isNotNull(observadores.usuarioId)
          : isNull(observadores.usuarioId),
      query.search === undefined
        ? undefined
        : or(
            sql`LOCATE(${query.search}, ${observadores.nombres}) > 0`,
            sql`LOCATE(${query.search}, ${observadores.apellidos}) > 0`,
          ),
    );
    return this.database.db.transaction(
      async (tx) => {
        const [{ total }] = await tx.select({ total: count() }).from(observadores).where(where);
        const items = await tx
          .select(projection)
          .from(observadores)
          .where(where)
          .orderBy(asc(observadores.creadoEn), asc(observadores.id))
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize);
        return { items, page: query.page, pageSize: query.pageSize, total };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  async detail(id: string) {
    const [observer] = await this.database.db
      .select(projection)
      .from(observadores)
      .where(eq(observadores.id, id));
    if (!observer) throw new NotFoundException('Observer not found');
    return observer;
  }

  async update(context: AuthContext, id: string, input: UpdateObserverDto) {
    if (
      input.firstNames === undefined &&
      input.lastNames === undefined &&
      input.phone === undefined
    )
      throw new BadRequestException('At least one editable field is required');
    return this.database.db.transaction(async (tx) => {
      const current = await this.authorize(tx, context, 'observers:update');
      const [observer] = await tx
        .select()
        .from(observadores)
        .where(eq(observadores.id, id))
        .for('update');
      if (!observer) throw new NotFoundException('Observer not found');
      const changes: Partial<typeof observadores.$inferInsert> = {};
      const fields: string[] = [];
      if (input.firstNames !== undefined && input.firstNames !== observer.nombres) {
        changes.nombres = input.firstNames;
        fields.push('firstNames');
      }
      if (input.lastNames !== undefined && input.lastNames !== observer.apellidos) {
        changes.apellidos = input.lastNames;
        fields.push('lastNames');
      }
      if (input.phone !== undefined && input.phone !== observer.telefono) {
        changes.telefono = input.phone;
        fields.push('phone');
      }
      if (!fields.length) return;
      await tx.update(observadores).set(changes).where(eq(observadores.id, id));
      await this.audit(tx, current, id, 'observers.updated', input.reason, undefined, { fields });
    });
  }

  async changeStatus(context: AuthContext, id: string, input: ChangeObserverStatusDto) {
    return this.database.db.transaction(async (tx) => {
      const current = await this.authorize(tx, context, 'observers:change-status');
      const [observer] = await tx
        .select()
        .from(observadores)
        .where(eq(observadores.id, id))
        .for('update');
      if (!observer) throw new NotFoundException('Observer not found');
      if (observer.activo === input.active) return;
      await tx.update(observadores).set({ activo: input.active }).where(eq(observadores.id, id));
      await this.audit(
        tx,
        current,
        id,
        input.active ? 'observers.activated' : 'observers.deactivated',
        input.reason,
        { active: observer.activo },
        { active: input.active },
      );
    });
  }
}
