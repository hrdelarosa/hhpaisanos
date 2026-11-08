import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  HttpException,
  type OnModuleInit,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { argon2id, hash, verify } from 'argon2';
import { parseCookie } from 'cookie';
import { and, eq, gt, gte, isNull, sql } from 'drizzle-orm';
import type { Request } from 'express';
import { DatabaseService } from '../../database/database.service.js';
import {
  auditoria,
  permisos,
  roles,
  rolPermisos,
  sesiones,
  usuarios,
} from '../../database/schema/index.js';
import { AUTH_CONFIG, type AuthConfig } from './auth.config.js';
import type { AuthContext } from './auth.types.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';

type AuthDb = Pick<DatabaseService['db'], 'select' | 'insert' | 'update'>;
const passwordOptions = { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const lifetimes = new Map([
  ['ADMIN', 30],
  ['ENLACE', 180],
  ['OBSERVADOR', 180],
]);
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const utc = (date: Date) => date.toISOString().replace('T', ' ').replace('Z', '000');
const afterMinutes = (now: string, minutes: number) =>
  utc(new Date(new Date(now.replace(' ', 'T') + 'Z').getTime() + minutes * 60000));

export const hashPassword = (password: string) => hash(password, passwordOptions);

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash = '';

  constructor(
    private readonly database: DatabaseService,
    @Inject(AUTH_CONFIG) readonly config: AuthConfig,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hashPassword(randomBytes(32).toString('hex'));
  }

  private async matches(encoded: string, password: string): Promise<boolean> {
    try {
      return encoded.startsWith('$argon2id$') && (await verify(encoded, password));
    } catch {
      return false;
    }
  }

  private async now(db: AuthDb): Promise<string> {
    const [row] = await db
      .select({ now: sql<string>`UTC_TIMESTAMP(6)` })
      .from(sql`(SELECT 1) AS clock`);
    return row.now;
  }

  private async audit(
    db: AuthDb,
    action: string,
    userId?: string,
    sessionId?: string,
  ): Promise<void> {
    // Explicit payload allowlist: no credentials, identifiers supplied at login, or row snapshots.
    await db.insert(auditoria).values({
      usuarioId: userId,
      sesionId: sessionId,
      accion: action,
      tipoEntidad: sessionId ? 'sesiones' : 'usuarios',
      entidadId: sessionId ?? userId,
      canal: 'web',
    });
  }

  async login(input: LoginDto): Promise<{ token: string; expires: Date }> {
    const result = await this.database.db.transaction(async (tx) => {
      // Serialize credential changes, failures and session issuance on the same user row.
      const [user] = await tx
        .select()
        .from(usuarios)
        .where(eq(usuarios.nombreUsuario, input.username))
        .for('update');
      const now = await this.now(tx);
      if (!user) {
        await this.matches(this.dummyHash, input.password);
        await this.audit(tx, 'auth.login.failed');
        return undefined;
      }
      if (user.bloqueadoHasta && user.bloqueadoHasta > now) {
        await this.matches(this.dummyHash, input.password);
        await this.audit(tx, 'auth.login.failed', user.id);
        return undefined;
      }
      const failures = user.bloqueadoHasta ? 0 : user.intentosFallidos;
      const [role] = await tx.select().from(roles).where(eq(roles.id, user.rolId)).for('share');
      const validPassword = await this.matches(
        user.activo && role?.activo ? user.passwordHash : this.dummyHash,
        input.password,
      );
      const minutes = role ? lifetimes.get(role.codigo) : undefined;
      if (!validPassword || !user.activo || !role?.activo || minutes === undefined) {
        if (user.activo && role?.activo && minutes !== undefined) {
          const count = Math.min(failures + 1, 5);
          await tx
            .update(usuarios)
            .set({
              intentosFallidos: count,
              bloqueadoHasta: count === 5 ? afterMinutes(now, 15) : null,
            })
            .where(eq(usuarios.id, user.id));
          if (count === 5) await this.audit(tx, 'auth.account.locked', user.id);
        } else if (user.bloqueadoHasta) {
          await tx
            .update(usuarios)
            .set({ intentosFallidos: 0, bloqueadoHasta: null })
            .where(eq(usuarios.id, user.id));
        }
        await this.audit(tx, 'auth.login.failed', user.id);
        return undefined;
      }
      const token = randomBytes(32).toString('base64url');
      const expiresAt = afterMinutes(now, minutes);
      await tx
        .update(usuarios)
        .set({ intentosFallidos: 0, bloqueadoHasta: null, ultimoAccesoEn: now })
        .where(eq(usuarios.id, user.id));
      const [{ id }] = await tx
        .insert(sesiones)
        .values({
          usuarioId: user.id,
          tokenHash: tokenHash(token),
          ultimaActividadEn: now,
          expiraPorInactividadEn: null,
          expiraEnAbsoluto: expiresAt,
        })
        .$returningId();
      await this.audit(tx, 'auth.login.succeeded', user.id, id);
      return { token, expires: new Date(expiresAt.replace(' ', 'T') + 'Z') };
    });
    if (!result) throw new UnauthorizedException('Invalid username or password');
    return result;
  }

  private readToken(request: Request): string | undefined {
    const token = parseCookie(request.headers.cookie ?? '')[this.config.cookieName];
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
  }

  async authenticate(request: Request): Promise<AuthContext> {
    const token = this.readToken(request);
    if (!token) throw new UnauthorizedException('Authentication required');
    const [row] = await this.database.db
      .select({ session: sesiones, user: usuarios, role: roles })
      .from(sesiones)
      .innerJoin(usuarios, eq(sesiones.usuarioId, usuarios.id))
      .innerJoin(roles, eq(usuarios.rolId, roles.id))
      .where(
        and(
          eq(sesiones.tokenHash, tokenHash(token)),
          isNull(sesiones.revocadaEn),
          gt(sesiones.expiraEnAbsoluto, sql`UTC_TIMESTAMP(6)`),
          eq(usuarios.activo, true),
          eq(roles.activo, true),
        ),
      );
    if (!row) throw new UnauthorizedException('Authentication required');
    const grants = await this.database.db
      .select({ code: permisos.codigo })
      .from(rolPermisos)
      .innerJoin(permisos, eq(rolPermisos.permisoId, permisos.id))
      .where(eq(rolPermisos.rolId, row.role.id));
    return {
      sessionId: row.session.id,
      user: {
        id: row.user.id,
        username: row.user.nombreUsuario,
        fullName: row.user.nombreCompleto,
        role: row.role.codigo,
        permissions: grants.map((grant) => grant.code),
        mustChangePassword: row.user.debeCambiarPassword,
      },
    };
  }

  async logout(request: Request): Promise<void> {
    const token = this.readToken(request);
    if (!token) return;
    const [session] = await this.database.db
      .select()
      .from(sesiones)
      .where(eq(sesiones.tokenHash, tokenHash(token)));
    if (!session) return;
    await this.database.db.transaction(async (tx) => {
      await tx
        .select({ id: usuarios.id })
        .from(usuarios)
        .where(eq(usuarios.id, session.usuarioId))
        .for('update');
      const now = await this.now(tx);
      const [current] = await tx
        .select()
        .from(sesiones)
        .where(eq(sesiones.id, session.id))
        .for('update');
      if (!current || current.revocadaEn) return;
      await tx
        .update(sesiones)
        .set({ revocadaEn: now, revocadaPor: session.usuarioId, motivoRevocacion: 'logout' })
        .where(eq(sesiones.id, session.id));
      await this.audit(tx, 'auth.session.revoked', session.usuarioId, session.id);
    });
  }

  // Locks the actor before administrative writes; callers keep all mutations in this transaction.
  async requireCurrentContext(db: AuthDb, context: AuthContext): Promise<AuthContext> {
    const [user] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, context.user.id))
      .for('update');
    if (!user?.activo) throw new UnauthorizedException('Authentication required');
    const [session] = await db
      .select({ id: sesiones.id })
      .from(sesiones)
      .where(
        and(
          eq(sesiones.id, context.sessionId),
          eq(sesiones.usuarioId, user.id),
          isNull(sesiones.revocadaEn),
          gt(sesiones.expiraEnAbsoluto, sql`UTC_TIMESTAMP(6)`),
        ),
      )
      .for('share');
    const [role] = await db.select().from(roles).where(eq(roles.id, user.rolId)).for('share');
    if (!session || !role?.activo) throw new UnauthorizedException('Authentication required');
    if (user.debeCambiarPassword)
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Password change required',
      });
    const grants = await db
      .select({ code: permisos.codigo })
      .from(rolPermisos)
      .innerJoin(permisos, eq(rolPermisos.permisoId, permisos.id))
      .where(eq(rolPermisos.rolId, role.id))
      .for('share');
    return {
      sessionId: session.id,
      user: {
        id: user.id,
        username: user.nombreUsuario,
        fullName: user.nombreCompleto,
        role: role.codigo,
        permissions: grants.map((grant) => grant.code),
        mustChangePassword: user.debeCambiarPassword,
      },
    };
  }

  async changePassword(context: AuthContext, input: ChangePasswordDto): Promise<void> {
    const result = await this.database.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(usuarios)
        .where(eq(usuarios.id, context.user.id))
        .for('update');
      const now = await this.now(tx);
      const [session] = await tx
        .select()
        .from(sesiones)
        .where(
          and(
            eq(sesiones.id, context.sessionId),
            eq(sesiones.usuarioId, user.id),
            isNull(sesiones.revocadaEn),
            gt(sesiones.expiraEnAbsoluto, now),
          ),
        )
        .for('update');
      const [role] = await tx.select().from(roles).where(eq(roles.id, user.rolId)).for('share');
      if (!user.activo || !role?.activo || !session) return 'unauthorized';
      const [{ count }] = await tx
        .select({ count: sql<number>`COUNT(*)` })
        .from(auditoria)
        .where(
          and(
            eq(auditoria.usuarioId, user.id),
            eq(auditoria.accion, 'auth.password.failed'),
            gte(auditoria.creadoEn, afterMinutes(now, -15)),
          ),
        );
      // Persistent per-account verification budget, shared across sessions and API processes.
      if (Number(count) >= 5) return 'limited';
      if (!(await this.matches(user.passwordHash, input.currentPassword))) {
        await this.audit(tx, 'auth.password.failed', user.id, session.id);
        return 'invalid';
      }
      if (input.currentPassword === input.newPassword) return 'reuse';
      const passwordHash = await hashPassword(input.newPassword);
      await tx
        .update(usuarios)
        .set({ passwordHash, debeCambiarPassword: false, passwordCambiadaEn: now })
        .where(eq(usuarios.id, user.id));
      await this.revokeUserSessions(tx, user.id, user.id, now, 'password_change');
      await this.audit(tx, 'auth.password.changed', user.id, session.id);
      return 'ok';
    });
    if (result === 'unauthorized') throw new UnauthorizedException('Authentication required');
    if (result === 'limited')
      throw new HttpException('Too many password verification attempts; try later', 429);
    if (result === 'invalid') throw new UnauthorizedException('Invalid current password');
    if (result === 'reuse')
      throw new BadRequestException('New password must differ from current password');
  }

  // Caller must hold the user row lock and include its account mutation in this transaction.
  async revokeUserSessions(
    db: AuthDb,
    userId: string,
    actorId: string,
    now: string,
    reason: string,
  ): Promise<void> {
    const active = await db
      .select({ id: sesiones.id })
      .from(sesiones)
      .where(
        and(
          eq(sesiones.usuarioId, userId),
          isNull(sesiones.revocadaEn),
          gt(sesiones.expiraEnAbsoluto, now),
        ),
      );
    await db
      .update(sesiones)
      .set({ revocadaEn: now, revocadaPor: actorId, motivoRevocacion: reason })
      .where(
        and(
          eq(sesiones.usuarioId, userId),
          isNull(sesiones.revocadaEn),
          gt(sesiones.expiraEnAbsoluto, now),
        ),
      );
    for (const session of active) await this.audit(db, 'auth.session.revoked', actorId, session.id);
  }
}
