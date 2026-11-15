import { HttpError } from '../../../lib/http';
import type { AttentionModule } from '../schemas/attention-modules';

export function moduleError(error: unknown, write = false): string {
  if (error instanceof Error && error.message === 'state_changed')
    return 'El módulo cambió. Revisa los datos actuales y vuelve a confirmar si corresponde.';
  if (error instanceof HttpError) {
    if (error.status === 403) return 'No se autorizó la operación. Verifica tus permisos.';
    if (error.status === 404) return 'El módulo ya no está disponible.';
    if (error.status === 400)
      return 'El servidor rechazó los datos. Revisa nombre, municipio y motivo.';
    if (error.status === 409)
      return 'Hay un conflicto. La edición de nombre o municipio se bloquea si existe cualquier asignación, incluso cancelada. Consulta el estado actual antes de volver a intentar.';
  }
  return write
    ? 'No se confirmó el resultado. Consulta el estado actual antes de volver a enviar; la operación podría haberse aplicado.'
    : 'No se pudo consultar el módulo. Reintenta la consulta.';
}
export function sameModule(a: AttentionModule, b: AttentionModule) {
  return (
    a.updatedAt === b.updatedAt &&
    a.active === b.active &&
    a.name === b.name &&
    a.municipality === b.municipality
  );
}
