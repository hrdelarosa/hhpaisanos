import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { asignaciones, auditoria, modulosAtencion } from '../../database/schema/index.js';
import { AuthService } from '../auth/auth.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import type { ChangeAttentionModuleStatusDto } from './dto/change-attention-module-status.dto.js';
import type { CreateAttentionModuleDto } from './dto/create-attention-module.dto.js';
import type { ListAttentionModulesQueryDto } from './dto/list-attention-modules-query.dto.js';
import type { UpdateAttentionModuleDto } from './dto/update-attention-module.dto.js';

type Transaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];
const projection = {
  id: modulosAtencion.id,
  name: modulosAtencion.nombre,
  municipality: modulosAtencion.municipio,
  active: modulosAtencion.activo,
  createdAt: sql<string>`CONCAT(REPLACE(${modulosAtencion.creadoEn}, ' ', 'T'), 'Z')`,
  updatedAt: sql<string>`CONCAT(REPLACE(${modulosAtencion.actualizadoEn}, ' ', 'T'), 'Z')`,
};

@Injectable()
export class AttentionModulesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  private async requirePermission(tx: Transaction, context: AuthContext, permission: string) {
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
    before: Record<string, unknown> | undefined,
    after: Record<string, unknown>,
    reason?: string,
  ) {
    await tx.insert(auditoria).values({
      usuarioId: context.user.id,
      sesionId: context.sessionId,
      tipoEntidad: 'modulos_atencion',
      entidadId: id,
      accion: action,
      valoresAnteriores: before,
      valoresNuevos: after,
      motivo: reason,
      canal: 'web',
    });
  }

  async create(input: CreateAttentionModuleDto, context: AuthContext) {
    return this.database.db.transaction(async (tx) => {
      const current = await this.requirePermission(tx, context, 'attention-modules:create');
      const values = { nombre: input.name, municipio: input.municipality, activo: true };
      const [{ id }] = await tx.insert(modulosAtencion).values(values).$returningId();
      await this.audit(tx, current, id, 'attention-modules.created', undefined, values);
      const [created] = await tx
        .select(projection)
        .from(modulosAtencion)
        .where(eq(modulosAtencion.id, id));
      return created;
    });
  }

  async list(query: ListAttentionModulesQueryDto) {
    const offset = (query.page - 1) * query.limit;
    if (!Number.isSafeInteger(offset)) throw new BadRequestException('Invalid page');
    const where = and(
      query.name === undefined
        ? undefined
        : sql`LOCATE(${query.name}, ${modulosAtencion.nombre}) > 0`,
      query.municipality === undefined
        ? undefined
        : eq(modulosAtencion.municipio, query.municipality),
      query.active === undefined ? undefined : eq(modulosAtencion.activo, query.active),
    );
    return this.database.db.transaction(
      async (tx) => {
        const [{ total }] = await tx.select({ total: count() }).from(modulosAtencion).where(where);
        const items = await tx
          .select(projection)
          .from(modulosAtencion)
          .where(where)
          .orderBy(desc(modulosAtencion.creadoEn), desc(modulosAtencion.id))
          .limit(query.limit)
          .offset(offset);
        return { items, page: query.page, limit: query.limit, total };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  async detail(id: string) {
    const [module] = await this.database.db
      .select(projection)
      .from(modulosAtencion)
      .where(eq(modulosAtencion.id, id));
    if (!module) throw new NotFoundException('Attention module not found');
    return module;
  }

  async update(id: string, input: UpdateAttentionModuleDto, context: AuthContext) {
    if (input.name === undefined && input.municipality === undefined)
      throw new BadRequestException('No editable fields');
    await this.database.db.transaction(async (tx) => {
      const current = await this.requirePermission(tx, context, 'attention-modules:update');
      const [module] = await tx
        .select(projection)
        .from(modulosAtencion)
        .where(eq(modulosAtencion.id, id))
        .for('update');
      if (!module) throw new NotFoundException('Attention module not found');
      const before: Record<string, string> = {};
      const after: { nombre?: string; municipio?: string } = {};
      if (input.name !== undefined && input.name !== module.name) {
        before.nombre = module.name;
        after.nombre = input.name;
      }
      if (input.municipality !== undefined && input.municipality !== module.municipality) {
        before.municipio = module.municipality;
        after.municipio = input.municipality;
      }
      if (Object.keys(after).length === 0) return;
      // The parent X lock blocks concurrent assignment FK inserts. Use a current read,
      // including cancelled assignments, rather than a potentially stale snapshot.
      const [assignment] = await tx
        .select({ id: asignaciones.id })
        .from(asignaciones)
        .where(eq(asignaciones.moduloId, id))
        .limit(1)
        .for('share');
      if (assignment) throw new ConflictException('Attention module has existing assignments');
      await tx.update(modulosAtencion).set(after).where(eq(modulosAtencion.id, id));
      await this.audit(tx, current, id, 'attention-modules.updated', before, after, input.reason);
    });
  }

  async changeStatus(id: string, input: ChangeAttentionModuleStatusDto, context: AuthContext) {
    await this.database.db.transaction(async (tx) => {
      const current = await this.requirePermission(tx, context, 'attention-modules:change-status');
      const [module] = await tx
        .select({ active: modulosAtencion.activo })
        .from(modulosAtencion)
        .where(eq(modulosAtencion.id, id))
        .for('update');
      if (!module) throw new NotFoundException('Attention module not found');
      if (module.active === input.active) return;
      await tx
        .update(modulosAtencion)
        .set({ activo: input.active })
        .where(eq(modulosAtencion.id, id));
      await this.audit(
        tx,
        current,
        id,
        input.active ? 'attention-modules.activated' : 'attention-modules.deactivated',
        { activo: module.active },
        { activo: input.active },
        input.reason,
      );
    });
  }
}
