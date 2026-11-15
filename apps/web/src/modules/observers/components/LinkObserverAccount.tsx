import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { HttpError } from '../../../lib/http';
import { useSession } from '../../auth/hooks/use-session';
import { usersKey } from '../../users/api/users';
import {
  findLinkableAccount,
  linkObserverAccount,
  type LinkableAccount,
} from '../api/account-linking';
import { observerQuery, observersKey } from '../api/observers';
import { reasonSchema, type Observer } from '../schemas/observers';
import { sameObserver } from '../utils/feedback';
import { ObserverField } from './ObserverField';

const attestationSchema = z.object({
  reason: reasonSchema,
  verified: z
    .boolean()
    .refine((v) => v, 'Confirma la acreditación supervisada antes de continuar.'),
});
function linkingError(error: unknown, write = false) {
  if (error instanceof Error && error.message === 'preflight_failed')
    return 'No se pudo verificar la cuenta y el perfil. No se envió la vinculación. Vuelve a consultarlos.';
  if (error instanceof Error && error.message === 'state_changed')
    return 'La cuenta o el perfil cambió o dejó de ser elegible. Consulta nuevamente y repite la acreditación y confirmación.';
  if (error instanceof HttpError) {
    if (error.status === 404)
      return 'Cuenta o perfil no disponible o no elegible. Comprueba el usuario exacto; no se distingue una cuenta inexistente de una no elegible.';
    if (error.status === 409)
      return 'Conflicto de vinculación: cuenta o perfil ya vinculado, no elegible o relación existente que requiere verificación separada. No se reemplazó ningún vínculo.';
    if (error.status === 403) return 'No se autorizó la vinculación. Verifica tus permisos.';
    if (error.status === 400)
      return 'El servidor rechazó los datos de vinculación. Revisa el usuario y el motivo.';
  }
  return write
    ? 'Resultado incierto: la vinculación podría haberse aplicado. Consulta el estado actual; no la reenvíes automáticamente. Un vínculo visible no demuestra por sí solo que esta solicitud se confirmó.'
    : 'No se pudo consultar la cuenta o el perfil. Reintenta la consulta.';
}
export function LinkObserverAccount({ observer }: { observer: Observer }) {
  const { user } = useSession();
  const client = useQueryClient();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [account, setAccount] = useState<LinkableAccount | null>(null);
  const [confirmation, setConfirmation] = useState<{
    observer: Observer;
    account: LinkableAccount;
    reason: string;
  } | null>(null);
  const [notice, setNotice] = useState('');
  const [refreshRequired, setRefreshRequired] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ reason: string; verified: boolean }>({
    resolver: zodResolver(attestationSchema),
    defaultValues: { reason: '', verified: false },
  });
  const read = () => client.fetchQuery({ ...observerQuery(observer.id), staleTime: 0 });
  const invalidate = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: observersKey }),
      client.invalidateQueries({ queryKey: usersKey }),
    ]);
  async function preflight(expected: Observer, target: LinkableAccount) {
    let current: Observer;
    let candidate: LinkableAccount;
    try {
      current = await read();
      candidate = await findLinkableAccount(target.username);
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) throw error;
      throw new Error('preflight_failed');
    }
    if (
      !sameObserver(current, expected) ||
      !current.active ||
      current.userId !== null ||
      candidate.id !== target.id ||
      candidate.username !== target.username ||
      candidate.fullName !== target.fullName
    )
      throw new Error('state_changed');
    return { observer: current, account: candidate };
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      await preflight(confirmed.observer, confirmed.account);
      await linkObserverAccount(observer.id, confirmed.account.id, confirmed.reason);
    },
    onSuccess: () =>
      setNotice(
        'Vinculación confirmada por el servidor. Las sesiones previas de la cuenta fueron revocadas; su titular debe iniciar sesión nuevamente.',
      ),
    onError: (error) => setNotice(linkingError(error, true)),
    onSettled: async () => {
      setConfirmation(null);
      setAccount(null);
      reset();
      setRefreshRequired(true);
      await invalidate();
      lock.current = false;
    },
  });
  if (!user?.permissions.includes('observers:link-account')) return null;
  return (
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">Vinculación de cuenta</h2>
      {notice && <p role={mutation.isSuccess ? 'status' : 'alert'}>{notice}</p>}
      {observer.userId ? (
        <>
          <p className="break-all">
            Relación actual: {observer.id} → {observer.userId}.
          </p>
          <p>
            No se admite desvincular ni reemplazar. Esta proyección no acredita la identidad ni
            expone evidencia de verificación; las relaciones heredadas requieren un proceso
            separado.
          </p>
          {user.role === 'ADMIN' && user.permissions.includes('users:read') && (
            <Link
              className="inline-flex min-h-touch items-center text-primary underline"
              to={`/cuentas/${observer.userId}`}
            >
              Consultar cuenta vinculada
            </Link>
          )}
        </>
      ) : !observer.active ? (
        <p>El perfil está inactivo y no es elegible para una nueva vinculación.</p>
      ) : refreshRequired ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            try {
              await read();
              setRefreshRequired(false);
              setUsername('');
              reset();
            } catch (error) {
              setNotice(linkingError(error));
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          Consultar estado antes de otra intención
        </Button>
      ) : confirmation ? (
        <section aria-label="Confirmación de vinculación" className="space-y-4">
          <h3 className="text-subheading">Confirmar vinculación supervisada</h3>
          <p className="break-words">
            Perfil: {confirmation.observer.firstNames} {confirmation.observer.lastNames} (
            {confirmation.observer.id}).
          </p>
          <p className="break-words whitespace-pre-wrap">
            Cuenta: {confirmation.account.username} · {confirmation.account.fullName} (
            {confirmation.account.id}).
          </p>
          <p>
            Se establece una relación única y se revocan las sesiones de la cuenta. Su titular
            deberá iniciar sesión nuevamente. No crea, activa ni desactiva cuentas o perfiles, ni
            asignaciones.
          </p>
          <p className="break-words whitespace-pre-wrap">Motivo: {confirmation.reason}</p>
          <div className="flex flex-wrap gap-4">
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                mutation.mutate(confirmation);
              }}
            >
              {mutation.isPending ? 'Validando y vinculando…' : 'Confirmar vinculación'}
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                setConfirmation(null);
                reset();
              }}
            >
              Cancelar
            </Button>
          </div>
        </section>
      ) : (
        <>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (lock.current || !username || Array.from(username).length > 50) return;
              lock.current = true;
              setBusy(true);
              setNotice('');
              setAccount(null);
              reset();
              mutation.reset();
              try {
                setAccount(await findLinkableAccount(username));
              } catch (error) {
                setNotice(linkingError(error));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            <label className="block space-y-2" htmlFor="link-username">
              Usuario exacto de la cuenta
              <Input
                id="link-username"
                value={username}
                disabled={busy}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setAccount(null);
                  reset();
                }}
                autoComplete="off"
              />
            </label>
            <p>
              Sin recortar espacios ni cambiar mayúsculas o acentos. Solo se devuelven cuentas
              OBSERVADOR activas, con rol activo, contraseña definitiva, sin bloqueo vigente ni otro
              perfil vinculado.
            </p>
            <Button
              variant="secondary"
              type="submit"
              disabled={busy || !username || Array.from(username).length > 50}
            >
              Buscar cuenta elegible
            </Button>
          </form>
          {account && (
            <form
              noValidate
              className="space-y-4"
              onSubmit={(event) => {
                void handleSubmit(async ({ reason }) => {
                  if (lock.current) return;
                  lock.current = true;
                  setBusy(true);
                  setNotice('');
                  try {
                    const current = await preflight(observer, account);
                    setConfirmation({ ...current, reason });
                  } catch (error) {
                    setNotice(linkingError(error));
                    setAccount(null);
                    reset();
                  } finally {
                    lock.current = false;
                    setBusy(false);
                  }
                })(event);
              }}
            >
              <p className="break-words whitespace-pre-wrap">
                Cuenta elegible: {account.username} · {account.fullName} ({account.id}).
              </p>
              <p>
                Verifica la identidad con el procedimiento institucional aprobado y presencia el
                inicio de sesión independiente del titular con sus credenciales definitivas. Los
                nombres coincidentes no son evidencia. No solicites contraseñas ni copias de
                documentos.
              </p>
              <label className="flex min-h-touch items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-5"
                  disabled={busy}
                  {...register('verified')}
                />
                Acredito que verifiqué la identidad, presencié el inicio de sesión independiente y
                comprobé la pareja exacta de perfil y cuenta. Es una declaración administrativa, no
                prueba criptográfica de consentimiento.
              </label>
              {errors.verified && <p role="alert">{errors.verified.message}</p>}
              <ObserverField
                id="link-reason"
                label="Motivo de vinculación"
                disabled={busy}
                error={errors.reason?.message}
                {...register('reason')}
              />
              <p>
                No incluyas credenciales, números de documentos ni datos personales innecesarios en
                el motivo.
              </p>
              <Button type="submit" disabled={busy}>
                Revisar vinculación
              </Button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
