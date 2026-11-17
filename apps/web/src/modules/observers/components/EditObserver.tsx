import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/button';
import { HttpError } from '../../../lib/http';
import { editObserver, observerQuery, observersKey } from '../api/observers';
import { editObserverSchema, type EditObserverInput, type Observer } from '../schemas/observers';
import { observerError, sameObserver } from '../utils/feedback';
import { ObserverField } from './ObserverField';

const values = (observer: Observer) => ({
  firstNames: observer.firstNames,
  lastNames: observer.lastNames,
  phone: observer.phone ?? '',
  reason: '',
});
export function EditObserver({ observer }: { observer: Observer }) {
  const client = useQueryClient();
  const [baseline, setBaseline] = useState(observer);
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EditObserverInput>({
    resolver: zodResolver(editObserverSchema),
    defaultValues: values(observer),
  });
  const readCurrent = () => client.fetchQuery({ ...observerQuery(observer.id), staleTime: 0 });
  const mutation = useMutation({
    retry: false,
    mutationFn: async (input: EditObserverInput) => {
      const current = await readCurrent().catch((error: unknown) => {
        if (error instanceof HttpError && error.status < 500) throw error;
        throw new Error('preflight_failed');
      });
      if (!sameObserver(current, baseline)) throw new Error('state_changed');
      const phone = input.phone === '' ? null : input.phone;
      await editObserver(observer.id, {
        reason: input.reason,
        ...(input.firstNames !== baseline.firstNames ? { firstNames: input.firstNames } : {}),
        ...(input.lastNames !== baseline.lastNames ? { lastNames: input.lastNames } : {}),
        ...(phone !== baseline.phone ? { phone } : {}),
      });
    },
    onSettled: () => client.invalidateQueries({ queryKey: observersKey }),
  });
  return (
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">Editar observador</h2>
      <p className="text-body-sm text-muted-foreground">
        Solo nombres, apellidos y teléfono. Deja el teléfono vacío para eliminarlo. Se conservan
        espacios y escritura originales.
      </p>
      {mutation.isError && <p role="alert">{observerError(mutation.error, true)}</p>}
      {reloadError && <p role="alert">{reloadError}</p>}
      {errors.root && <output>{errors.root.message}</output>}
      {mutation.isSuccess && (
        <output>
          Edición confirmada por el servidor. Carga los datos actuales antes de otra edición.
        </output>
      )}
      <form
        noValidate
        className="space-y-6"
        onSubmit={handleSubmit((input) => {
          if (mutation.isPending || reloading || mutation.isSuccess || mutation.isError) return;
          if (
            input.firstNames === baseline.firstNames &&
            input.lastNames === baseline.lastNames &&
            (input.phone || null) === baseline.phone
          ) {
            setError('root', { message: 'No hay cambios que guardar.' });
            return;
          }
          mutation.mutate(input);
        })}
      >
        <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
          <legend className="mb-4 text-label">Datos del perfil</legend>
          <ObserverField
            id="edit-firstNames"
            label="Nombres"
            error={errors.firstNames?.message}
            disabled={mutation.isPending || reloading}
            {...register('firstNames')}
          />
          <div className="sm:col-span-2">
            <ObserverField
              id="edit-lastNames"
              label="Apellidos"
              error={errors.lastNames?.message}
              disabled={mutation.isPending || reloading}
              {...register('lastNames')}
            />
          </div>
        </fieldset>
        <div className="space-y-4 border-t pt-4">
          <ObserverField
            id="edit-phone"
            label="Teléfono (opcional)"
            type="tel"
            error={errors.phone?.message}
            disabled={mutation.isPending || reloading}
            {...register('phone')}
          />
          <ObserverField
            id="edit-reason"
            label="Motivo de edición"
            error={errors.reason?.message}
            disabled={mutation.isPending || reloading}
            {...register('reason')}
          />
          <p className="text-body-sm text-muted-foreground">
            Tras un envío o si los datos cambiaron, revisa el detalle y carga los datos actuales.
            Esto reemplaza el formulario.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            type="submit"
            disabled={mutation.isPending || reloading || mutation.isSuccess || mutation.isError}
          >
            {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending || reloading}
            onClick={async () => {
              setReloading(true);
              setReloadError('');
              try {
                const current = await readCurrent();
                setBaseline(current);
                reset(values(current));
                mutation.reset();
              } catch (error) {
                setReloadError(observerError(error));
              } finally {
                setReloading(false);
              }
            }}
          >
            {reloading ? 'Consultando…' : 'Cargar datos actuales'}
          </Button>
        </div>
      </form>
    </section>
  );
}
