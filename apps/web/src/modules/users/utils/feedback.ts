import { HttpError } from '../../../lib/http';
import type { UserAccount } from '../schemas/users';

export function userError(error: unknown, write = false): string {
  if (error instanceof Error && error.message === 'preflight_failed')
    return 'No se pudo verificar el estado actual. No se envió ningún cambio.';
  if (error instanceof Error && error.message === 'state_changed')
    return 'La cuenta cambió. Carga los datos actuales y vuelve a revisar y confirmar.';
  if (error instanceof HttpError) {
    if (error.status === 403)
      return 'No se autorizó la operación. Verifica tus permisos; las cuentas ADMIN están protegidas.';
    if (error.status === 404) return 'La cuenta ya no está disponible.';
    if (error.status === 400)
      return 'El servidor rechazó los datos. Revisa los campos y el motivo.';
    if (error.status === 409)
      return 'Hay un conflicto; el nombre de usuario podría estar ocupado. Consulta el estado actual.';
    if (error.status === 429) return 'Demasiadas solicitudes. Espera antes de volver a intentar.';
  }
  return write
    ? 'No se confirmó el resultado. Consulta el estado actual antes de volver a enviar; la operación podría haberse aplicado.'
    : 'No se pudo consultar la cuenta. Reintenta la consulta.';
}
export function sameUser(a: UserAccount, b: UserAccount) {
  return (
    a.updatedAt === b.updatedAt &&
    a.fullName === b.fullName &&
    a.roleId === b.roleId &&
    a.active === b.active &&
    a.mustChangePassword === b.mustChangePassword
  );
}
