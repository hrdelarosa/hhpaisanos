import { HttpError } from '../../../lib/http';

export function administrativeAttendanceError(error: unknown, write = false) {
  if (error instanceof Error && error.message === 'state_changed')
    return 'El registro cambió o ya fue revisado. No se envió la decisión. Consulta y vuelve a confirmar.';
  if (error instanceof Error && error.message === 'preflight_failed')
    return 'No se pudo revalidar el registro. No se envió la decisión. Reintenta la lectura.';
  if (error instanceof HttpError && error.status < 500) {
    if (error.status === 403) return 'No tienes permiso para esta operación o lectura.';
    if (error.status === 404) return 'El registro no está disponible.';
    if (error.status === 409)
      return 'Conflicto: versión desactualizada, registro ya revisado o transición no permitida. Consulta y vuelve a confirmar.';
    if (error.status === 400) return 'El servidor rechazó los datos de revisión.';
    return 'El servidor rechazó la solicitud.';
  }
  return write
    ? 'Resultado incierto: la decisión podría haberse aplicado. Consulta el estado antes de otra intención. No se reenvió ni se confirma por una lectura posterior.'
    : 'No se pudo consultar la asistencia. Reintenta la lectura.';
}
