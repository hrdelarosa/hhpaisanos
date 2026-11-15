import { HttpError } from '../../../lib/http';
import type { Assignment } from '../schemas/assignments';

export function assignmentError(error: unknown, write = false) {
  if (error instanceof Error && error.message === 'state_changed')
    return 'El estado cambió. Consulta nuevamente y revisa otra vez antes de confirmar. No se envió la operación.';
  if (error instanceof Error && error.message === 'preflight_failed')
    return 'No se pudo revalidar el estado. No se envió la operación. Consulta nuevamente.';
  if (error instanceof Error && error.message === 'ineligible')
    return 'Observador o módulo inactivo, operativo cerrado o fechas fuera del operativo. No se envió la operación.';
  if (error instanceof HttpError && error.status < 500) {
    if (error.status === 403) return 'No tienes permiso para esta operación o lectura.';
    if (error.status === 404) return 'El registro ya no está disponible.';
    if (error.status === 409)
      return 'Conflicto: versión desactualizada, período superpuesto, transición no permitida o asistencia histórica protegida. Consulta y vuelve a revisar; no se reintentó.';
    if (error.status === 400)
      return 'El servidor rechazó los datos. Revisa fechas, horarios, selección y motivo.';
    return 'El servidor rechazó la solicitud. Consulta el estado antes de continuar.';
  }
  return write
    ? 'Resultado incierto: la operación podría haberse aplicado. Consulta los períodos antes de una nueva intención. No se reenvía automáticamente ni se considera confirmada por una lectura posterior.'
    : 'No se pudo consultar el estado. Reintenta la lectura.';
}
export function assignmentStatus(assignment: Assignment) {
  if (assignment.cancelledAt) return 'Cancelada';
  // Display-only calendar context, never a write or Attendance authorization precondition.
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (assignment.validTo < today) return 'Finalizada por vigencia';
  return assignment.validFrom > today ? 'Programada' : 'Vigente por fechas';
}
