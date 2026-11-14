import { Button } from '../../../components/ui/button';
import { useSession } from '../hooks/use-session';

export function SessionStatus() {
  const session = useSession();
  if (session.status === 'loading') return <output>Verificando sesión…</output>;
  return (
    <section className="mx-auto max-w-form space-y-4">
      <h1 className="text-heading">
        {session.status === 'logoutFailed'
          ? 'Cierre de sesión sin confirmar'
          : 'No se pudo verificar la sesión'}
      </h1>
      <p role="alert">
        {session.status === 'logoutFailed'
          ? session.notice
          : 'No mostraremos contenido privado hasta verificar tu sesión. Revisa la conexión y vuelve a intentarlo.'}
      </p>
      <div className="flex flex-wrap gap-4">
        {session.status !== 'logoutFailed' && (
          <Button onClick={session.recheck} disabled={session.busy}>
            Volver a verificar
          </Button>
        )}
        <Button variant="secondary" onClick={() => void session.logout()} disabled={session.busy}>
          Reintentar cierre de sesión
        </Button>
      </div>
    </section>
  );
}
