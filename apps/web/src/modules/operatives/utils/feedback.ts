import { HttpError } from '../../../lib/http';

export function operativeError(error: unknown, mutation = false): string {
  if (error instanceof HttpError) {
    if (error.status === 403) return 'No se autorizó la operación. Verifica tus permisos.';
    if (error.status === 404) return 'El operativo ya no está disponible.';
    if (error.status === 400)
      return 'El servidor rechazó los datos. Revisa nombre, fechas, tolerancia y motivo según la operación.';
    if (error.status === 409)
      return 'Hay un conflicto: el operativo puede existir, haber cambiado de estado o tener un intervalo vencido o inválido. Revisa los datos actuales antes de intentarlo nuevamente.';
  }
  return mutation
    ? 'No se confirmó el resultado. Consulta el estado actual antes de volver a enviar; la operación podría haberse aplicado.'
    : 'No se pudo consultar el operativo. Reintenta la consulta.';
}
export const statusLabels = { borrador: 'Borrador', activo: 'Activo', cerrado: 'Cerrado' };
