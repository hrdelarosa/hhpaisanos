import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service.js';
import { auditoria, observadores, permisos, roles, usuarios } from '../../database/schema/index.js';
import { AuthService, hashPassword } from '../auth/auth.service.js';
import type { AuthContext } from '../auth/auth.types.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { ChangeUserStatusDto } from './dto/change-user-status.dto.js';
import type { AssignUserRoleDto } from './dto/assign-user-role.dto.js';
import type { ResetUserPasswordDto } from './dto/reset-user-password.dto.js';

type Transaction = Parameters<Parameters<DatabaseService['db']['transaction']>[0]>[0];
type Account = typeof usuarios.$inferSelect;
const managedRoles = ['ENLACE', 'OBSERVADOR'];
const userFields = {
  id: usuarios.id,
  username: usuarios.nombreUsuario,
  fullName: usuarios.nombreCompleto,
  roleId: usuarios.rolId,
  role: roles.codigo,
  active: usuarios.activo,
  mustChangePassword: usuarios.debeCambiarPassword,
  lastLoginAt: usuarios.ultimoAccesoEn,
  createdAt: usuarios.creadoEn,
  updatedAt: usuarios.actualizadoEn,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly auth: AuthService,
  ) {}

  private requireAdmin(context: AuthContext, permission: string): void {
    if (context.user.role !== 'ADMIN' || !context.user.permissions.includes(permission)) {
      throw new ForbiddenException('Insufficient administrative permissions');
    }
  }

  async list(context: AuthContext, query: ListUsersQueryDto) {
    this.requireAdmin(context, 'users:read');
    const search = query.search?.replace(/[!%_]/g, '!$&');
    const where = and(
      query.active === undefined ? undefined : eq(usuarios.activo, query.active),
      query.roleId === undefined ? undefined : eq(usuarios.rolId, query.roleId),
      search === undefined
        ? undefined
        : or(
            sql`${usuarios.nombreUsuario} LIKE ${`%${search}%`} ESCAPE '!'`,
            sql`${usuarios.nombreCompleto} LIKE ${`%${search}%`} ESCAPE '!'`,
          ),
    );
    // A single consistent snapshot keeps total and page aligned during concurrent writes.
    return this.database.db.transaction(async (tx) => {
      const [{ total }] = await tx
        .select({ total: sql<number>`COUNT(*)` })
        .from(usuarios)
        .where(where);
      const items = await tx
        .select(userFields)
        .from(usuarios)
        .innerJoin(roles, eq(usuarios.rolId, roles.id))
        .where(where)
        .orderBy(asc(usuarios.creadoEn), asc(usuarios.id))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return { items, page: query.page, pageSize: query.pageSize, total: Number(total) };
    });
  }

  async detail(context: AuthContext, id: string) {
    this.requireAdmin(context, 'users:read');
    const [user] = await this.database.db
      .select(userFields)
      .from(usuarios)
      .innerJoin(roles, eq(usuarios.rolId, roles.id))
      .where(eq(usuarios.id, id));
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async roles(context: AuthContext) {
    this.requireAdmin(context, 'roles:read');
    return this.database.db
      .select({
        id: roles.id,
        code: roles.codigo,
        name: roles.nombre,
        description: roles.descripcion,
        active: roles.activo,
      })
      .from(roles)
      .orderBy(asc(roles.codigo));
  }

  async permissions(context: AuthContext) {
    this.requireAdmin(context, 'permissions:read');
    return this.database.db
      .select({ id: permisos.id, code: permisos.codigo, description: permisos.descripcion })
      .from(permisos)
      .orderBy(asc(permisos.codigo));
  }

  private async assignableRole(tx: Transaction, id: string) {
    const [role] = await tx.select().from(roles).where(eq(roles.id, id)).for('share');
    if (!role?.activo || !managedRoles.includes(role.codigo)) {
      throw new ForbiddenException('Role is not assignable');
    }
    return role;
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
      tipoEntidad: 'usuarios',
      accion: action,
      motivo: reason,
      canal: 'web',
      valoresAnteriores: before,
      valoresNuevos: after,
    });
  }

  async create(context: AuthContext, input: CreateUserDto) {
    this.requireAdmin(context, 'users:create');
    try {
      return await this.database.db.transaction(async (tx) => {
        const current = await this.auth.requireCurrentContext(tx, context);
        this.requireAdmin(current, 'users:create');
        const role = await this.assignableRole(tx, input.roleId);
        const temporaryPassword = randomBytes(32).toString('base64url');
        const [{ id }] = await tx
          .insert(usuarios)
          .values({
            nombreUsuario: input.username,
            nombreCompleto: input.fullName,
            rolId: role.id,
            passwordHash: await hashPassword(temporaryPassword),
            activo: true,
            debeCambiarPassword: true,
            intentosFallidos: 0,
          })
          .$returningId();
        await this.audit(tx, current, id, 'users.created', undefined, undefined, {
          roleId: role.id,
          active: true,
          mustChangePassword: true,
        });
        return { id, temporaryPassword };
      });
    } catch (error) {
      // Drizzle wraps mysql2 errors; inspect only the code, never surface SQL or parameters.
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (
        typeof cause === 'object' &&
        cause !== null &&
        'code' in cause &&
        cause.code === 'ER_DUP_ENTRY'
      ) {
        throw new ConflictException('Username already exists');
      }
      throw error;
    }
  }

  private async mutate<T>(
    context: AuthContext,
    id: string,
    permission: string,
    operation: (tx: Transaction, current: AuthContext, user: Account, now: string) => Promise<T>,
  ) {
    this.requireAdmin(context, permission);
    return this.database.db.transaction(async (tx) => {
      const current = await this.auth.requireCurrentContext(tx, context);
      this.requireAdmin(current, permission);
      const [user] = await tx.select().from(usuarios).where(eq(usuarios.id, id)).for('update');
      if (!user) throw new NotFoundException('User not found');
      const [role] = await tx.select().from(roles).where(eq(roles.id, user.rolId)).for('share');
      // No ADMIN mutation path exists, including self-mutation and concurrent requests.
      if (!role || !managedRoles.includes(role.codigo))
        throw new ForbiddenException('Account is protected');
      const [{ now }] = await tx
        .select({ now: sql<string>`UTC_TIMESTAMP(6)` })
        .from(sql`(SELECT 1) AS clock`);
      return operation(tx, current, user, now);
    });
  }

  async update(context: AuthContext, id: string, input: UpdateUserDto) {
    return this.mutate(context, id, 'users:update', async (tx, current, user) => {
      if (user.nombreCompleto === input.fullName) return;
      await tx.update(usuarios).set({ nombreCompleto: input.fullName }).where(eq(usuarios.id, id));
      // Audit the changed field, not copies of personal names.
      await this.audit(tx, current, id, 'users.updated', input.reason, undefined, {
        fields: ['fullName'],
      });
    });
  }

  async changeStatus(context: AuthContext, id: string, input: ChangeUserStatusDto) {
    return this.mutate(context, id, 'users:change-status', async (tx, current, user, now) => {
      if (user.activo === input.active) return;
      await tx.update(usuarios).set({ activo: input.active }).where(eq(usuarios.id, id));
      if (!input.active)
        await this.auth.revokeUserSessions(tx, id, current.user.id, now, 'account_deactivated');
      await this.audit(
        tx,
        current,
        id,
        input.active ? 'users.activated' : 'users.deactivated',
        input.reason,
        { active: user.activo },
        { active: input.active },
      );
    });
  }

  async assignRole(context: AuthContext, id: string, input: AssignUserRoleDto) {
    return this.mutate(context, id, 'users:assign-role', async (tx, current, user, now) => {
      await this.assignableRole(tx, input.roleId);
      if (user.rolId === input.roleId) return;
      const [observer] = await tx
        .select({ id: observadores.id })
        .from(observadores)
        .where(eq(observadores.usuarioId, id))
        .for('update');
      if (observer) throw new ConflictException('Observer-linked accounts cannot change role');
      await tx.update(usuarios).set({ rolId: input.roleId }).where(eq(usuarios.id, id));
      await this.auth.revokeUserSessions(tx, id, current.user.id, now, 'role_change');
      await this.audit(
        tx,
        current,
        id,
        'users.role.changed',
        input.reason,
        { roleId: user.rolId },
        { roleId: input.roleId },
      );
    });
  }

  async resetPassword(context: AuthContext, id: string, input: ResetUserPasswordDto) {
    return this.mutate(context, id, 'users:reset-password', async (tx, current, _user, now) => {
      const temporaryPassword = randomBytes(32).toString('base64url');
      await tx
        .update(usuarios)
        .set({
          passwordHash: await hashPassword(temporaryPassword),
          debeCambiarPassword: true,
          passwordCambiadaEn: now,
          intentosFallidos: 0,
          bloqueadoHasta: null,
        })
        .where(eq(usuarios.id, id));
      await this.auth.revokeUserSessions(tx, id, current.user.id, now, 'administrative_reset');
      await this.audit(tx, current, id, 'users.password.reset', input.reason, undefined, {
        mustChangePassword: true,
      });
      return { id, temporaryPassword };
    });
  }
}
