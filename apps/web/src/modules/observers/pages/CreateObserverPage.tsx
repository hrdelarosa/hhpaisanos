import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { useSession } from '../../auth/hooks/use-session';
import { createObserver, observersKey } from '../api/observers';
import { ObserverField } from '../components/ObserverField';
import { createObserverSchema, type CreateObserverInput } from '../schemas/observers';
import { observerError, uncertainWrite } from '../utils/feedback';

export function CreateObserverPage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const [uncertain, setUncertain] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateObserverInput>({
    resolver: zodResolver(createObserverSchema),
    defaultValues: { firstNames: '', lastNames: '', phone: '' },
  });
  const mutation = useMutation({
    mutationFn: createObserver,
    retry: false,
    onSuccess: async (observer) => {
      await client.invalidateQueries({ queryKey: observersKey });
      if (user?.permissions.includes('observers:read'))
        void navigate(`/observadores/${observer.id}`);
      else reset();
    },
    onError: async (error) => {
      setUncertain(uncertainWrite(error));
      await client.invalidateQueries({ queryKey: observersKey });
    },
  });
  return (
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h1 className="text-heading">Crear observador</h1>
      <p>
        Se crea un perfil activo, sin cuenta vinculada ni asignaciones. No se crea una cuenta de
        acceso. El estado, identificador y fechas los controla el servidor.
      </p>
      <p>
        Los nombres y teléfonos no son únicos. Revisa el listado antes de crear otro perfil de la
        misma persona.
      </p>
      {mutation.isError && <p role="alert">{observerError(mutation.error, true)}</p>}
      {mutation.isSuccess && <output>Perfil creado y activo, confirmado por el servidor.</output>}
      {uncertain && (
        <div className="space-y-2">
          <p>
            No reenvíes sin comprobar si el perfil ya existe. Si no puedes consultarlo, solicita una
            revisión autorizada.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setUncertain(false);
              mutation.reset();
            }}
          >
            Ya verifiqué que no se creó el perfil
          </Button>
        </div>
      )}
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((input) => {
          if (!mutation.isPending && !uncertain) mutation.mutate(input);
        })}
      >
        <ObserverField
          id="observer-firstNames"
          label="Nombres"
          error={errors.firstNames?.message}
          disabled={mutation.isPending}
          {...register('firstNames')}
        />
        <ObserverField
          id="observer-lastNames"
          label="Apellidos"
          error={errors.lastNames?.message}
          disabled={mutation.isPending}
          {...register('lastNames')}
        />
        <ObserverField
          id="observer-phone"
          label="Teléfono (opcional)"
          type="tel"
          error={errors.phone?.message}
          disabled={mutation.isPending}
          {...register('phone')}
        />
        <Button type="submit" disabled={mutation.isPending || uncertain}>
          {mutation.isPending ? 'Creando…' : 'Guardar observador'}
        </Button>
      </form>
    </section>
  );
}
