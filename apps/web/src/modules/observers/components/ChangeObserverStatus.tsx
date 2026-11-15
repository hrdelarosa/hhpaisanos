import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/button';
import { HttpError } from '../../../lib/http';
import { changeObserverStatus, observerQuery, observersKey } from '../api/observers';
import { statusSchema, type Observer } from '../schemas/observers';
import { observerError, sameObserver } from '../utils/feedback';
import { ObserverField } from './ObserverField';

export function ChangeObserverStatus({ observer }: { observer: Observer }) {
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState<{ observer: Observer; reason: string } | null>(
    null,
  );
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ reason: string }>({ resolver: zodResolver(statusSchema) });
  const readCurrent = () => client.fetchQuery({ ...observerQuery(observer.id), staleTime: 0 });
  const mutation = useMutation({
    retry: false,
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      const current = await readCurrent().catch((error: unknown) => {
        if (error instanceof HttpError && error.status < 500) throw error;
        throw new Error('preflight_failed');
      });
      if (!sameObserver(current, confirmed.observer)) throw new Error('state_changed');
      await changeObserverStatus(observer.id, {
        active: !confirmed.observer.active,
        reason: confirmed.reason,
      });
    },
    onSuccess: () => {
      setNotice('Cambio de estado confirmado por el servidor.');
      reset();
    },
    onError: (error) => setNotice(observerError(error, true)),
    onSettled: async () => {
      setConfirmation(null);
      await client.invalidateQueries({ queryKey: observersKey });
    },
  });
  return (
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">Estado del perfil</h2>
      {notice && <p role={mutation.isSuccess ? 'status' : 'alert'}>{notice}</p>}
      {confirmation ? (
        <section aria-labelledby="status-confirm-title" className="space-y-4">
          <h3 id="status-confirm-title" className="text-subheading">
            Confirmar {confirmation.observer.active ? 'desactivación' : 'activación'}
          </h3>
          <p>
            {confirmation.observer.firstNames} {confirmation.observer.lastNames}. Estado actual:{' '}
            {confirmation.observer.active ? 'Activo' : 'Inactivo'}.
          </p>
          <p>
            El perfil quedará {confirmation.observer.active ? 'inactivo' : 'activo'}. No cambia el
            estado de la cuenta, sus sesiones ni las asignaciones. Se conserva el historial.
          </p>
          {confirmation.observer.active && (
            <p>
              La desactivación impide nuevas asignaciones y el acceso personal que requiere un
              perfil activo.
            </p>
          )}
          <p className="whitespace-pre-wrap">Motivo: {confirmation.reason}</p>
          <div className="flex flex-wrap gap-4">
            <Button
              variant={confirmation.observer.active ? 'destructive' : 'primary'}
              disabled={mutation.isPending}
              onClick={() => {
                if (!mutation.isPending) mutation.mutate(confirmation);
              }}
            >
              {mutation.isPending ? 'Validando y enviando…' : 'Confirmar cambio de estado'}
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirmation(null)}
            >
              Cancelar
            </Button>
          </div>
        </section>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={handleSubmit(async ({ reason }) => {
            if (preparing || mutation.isPending) return;
            setPreparing(true);
            setNotice('');
            mutation.reset();
            try {
              const current = await readCurrent();
              if (!sameObserver(current, observer))
                setNotice(observerError(new Error('state_changed')));
              else setConfirmation({ observer: current, reason });
            } catch (error) {
              setNotice(observerError(error));
            } finally {
              setPreparing(false);
            }
          })}
        >
          <ObserverField
            id="status-reason"
            label="Motivo del cambio de estado"
            error={errors.reason?.message}
            disabled={preparing || mutation.isPending}
            {...register('reason')}
          />
          <Button type="submit" variant="secondary" disabled={preparing || mutation.isPending}>
            {preparing
              ? 'Consultando estado actual…'
              : observer.active
                ? 'Revisar desactivación'
                : 'Revisar activación'}
          </Button>
        </form>
      )}
    </section>
  );
}
