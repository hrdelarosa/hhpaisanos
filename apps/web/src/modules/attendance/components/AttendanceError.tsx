import { Button } from '../../../components/ui/button';
import { HttpError } from '../../../lib/http';

export function AttendanceError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div role="alert" className="space-y-4">
      <p>
        {error instanceof HttpError && error.status === 403
          ? 'No se autorizó la consulta. Se requiere un perfil de observador activo y vinculado, además del permiso de lectura.'
          : 'No se pudo cargar la asistencia. Revisa tu conexión e intenta de nuevo.'}
      </p>
      <Button variant="secondary" onClick={retry}>
        Reintentar
      </Button>
    </div>
  );
}
