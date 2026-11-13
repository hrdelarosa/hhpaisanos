import { ForbiddenException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { DatabaseService } from '../../database/database.service.js';
import { auditoria } from '../../database/schema/index.js';
import type { AuthService } from '../auth/auth.service.js';
import type { AuthContext } from '../auth/auth.types.js';

export type AttendanceTransaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

export async function authorizePersonalAttendance(
  tx: AttendanceTransaction,
  auth: AuthService,
  context: AuthContext,
  permission: 'attendance:capture-own' | 'attendance:read-own',
) {
  const current = await auth.requireCurrentContext(tx, context);
  if (current.user.role !== 'OBSERVADOR' || !current.user.permissions.includes(permission))
    throw new ForbiddenException('Insufficient permissions');
  return current;
}

export type AdministrativeAttendancePermission =
  | 'attendance:read'
  | 'attendance:capture-manual'
  | 'attendance:review'
  | 'attendance:correct'
  | 'attendance:annul';

export async function authorizeAdministrativeAttendance(
  tx: AttendanceTransaction,
  auth: AuthService,
  context: AuthContext,
  permission: AdministrativeAttendancePermission,
) {
  const current = await auth.requireCurrentContext(tx, context);
  // The approved organizational scope is Guerrero, not an implicit national/office scope.
  if (
    !['ADMIN', 'ENLACE'].includes(current.user.role) ||
    !current.user.permissions.includes(permission)
  )
    throw new ForbiddenException('Insufficient permissions');
  return current;
}

export async function hasAdministrativeLink(
  tx: AttendanceTransaction,
  observerId: string,
  userId: string,
) {
  const [evidence] = await tx
    .select({ id: auditoria.id })
    .from(auditoria)
    .where(
      and(
        eq(auditoria.tipoEntidad, 'observadores'),
        eq(auditoria.entidadId, observerId),
        eq(auditoria.accion, 'observers.account.linked'),
        sql`JSON_UNQUOTE(JSON_EXTRACT(${auditoria.valoresNuevos}, '$.userId')) = ${userId}`,
        sql`JSON_UNQUOTE(JSON_EXTRACT(${auditoria.valoresNuevos}, '$.verificationMethod')) = 'supervised_administrative'`,
      ),
    )
    .limit(1)
    .for('share');
  return Boolean(evidence);
}
