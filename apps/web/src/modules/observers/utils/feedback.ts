import { HttpError } from '../../../lib/http';
import type { Observer } from '../schemas/observers';

export function uncertainWrite(error: unknown) {
  return (
    !(error instanceof HttpError && error.status >= 400 && error.status < 500) &&
    !(error instanceof Error && error.message === 'state_changed')
  );
}
export function observerError(error: unknown, write = false): string {
  if (error instanceof Error && error.message === 'unexpected_creation_response')
    return 'El servidor respondió con un perfil en un estado inesperado. Verifica el listado antes de crear otro.';
  if (error instanceof Error && error.message === 'preflight_failed')
    return 'No se pudo verificar el estado actual. No se envió ningún cambio. Reintenta la consulta antes de continuar.';
  if (error instanceof Error && error.message === 'state_changed')
    return 'El perfil cambió. Revisa los datos actuales y vuelve a confirmar si corresponde.';
  if (error instanceof HttpError) {
    if (error.status === 403) return 'No se autorizó la operación. Verifica tus permisos.';
    if (error.status === 404) return 'El perfil ya no está disponible.';
    if (error.status === 400)
      return 'El servidor rechazó los datos. Revisa nombres, apellidos, teléfono y motivo.';
    if (error.status === 409)
      return 'Hay un conflicto o un registro duplicado. Consulta el estado actual antes de volver a intentar.';
  }
  return write
    ? 'No se confirmó el resultado. Consulta el estado actual antes de volver a enviar; la operación podría haberse aplicado.'
    : 'No se pudo consultar el perfil. Reintenta la consulta.';
}
export function sameObserver(a: Observer, b: Observer) {
  return (
    a.updatedAt === b.updatedAt &&
    a.active === b.active &&
    a.userId === b.userId &&
    a.firstNames === b.firstNames &&
    a.lastNames === b.lastNames &&
    a.phone === b.phone
  );
}
