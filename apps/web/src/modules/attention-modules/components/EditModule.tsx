import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/button';
import { editModule, moduleQuery, modulesKey } from '../api/attention-modules';
import {
  editModuleSchema,
  type EditModuleInput,
  type AttentionModule,
} from '../schemas/attention-modules';
import { moduleError, sameModule } from '../utils/feedback';
import { ModuleField } from './ModuleField';

export function EditModule({ module }: { module: AttentionModule }) {
  const client = useQueryClient();
  const [baseline, setBaseline] = useState(module);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<EditModuleInput>({
    resolver: zodResolver(editModuleSchema),
    defaultValues: { name: module.name, municipality: module.municipality, reason: '' },
  });
  const mutation = useMutation({
    retry: false,
    mutationFn: async (input: EditModuleInput) => {
      const current = await client.fetchQuery({ ...moduleQuery(module.id), staleTime: 0 });
      if (!sameModule(current, baseline)) throw new Error('state_changed');
      await editModule(module.id, {
        reason: input.reason,
        ...(input.name !== baseline.name ? { name: input.name } : {}),
        ...(input.municipality !== baseline.municipality
          ? { municipality: input.municipality }
          : {}),
      });
    },
    onSuccess: () => reset(undefined, { keepValues: true }),
    onSettled: () => client.invalidateQueries({ queryKey: modulesKey }),
  });
  return (
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">Editar módulo</h2>
      <p className="text-body-sm text-muted-foreground">
        Solo se pueden modificar nombre y municipio. Cualquier asignación existente, incluso
        cancelada, bloquea cambios efectivos.
      </p>
      {mutation.isError && <p role="alert">{moduleError(mutation.error, true)}</p>}
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
          if (mutation.isPending) return;
          if (input.name === baseline.name && input.municipality === baseline.municipality) {
            setError('root', { message: 'No hay cambios que guardar.' });
            return;
          }
          mutation.mutate(input);
        })}
      >
        <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
          <legend className="mb-4 text-label">Datos del punto de atención</legend>
          <ModuleField
            id="edit-name"
            label="Nombre"
            error={errors.name?.message}
            disabled={mutation.isPending}
            {...register('name')}
          />
          <ModuleField
            id="edit-municipality"
            label="Municipio"
            error={errors.municipality?.message}
            disabled={mutation.isPending}
            {...register('municipality')}
          />
        </fieldset>
        <div className="space-y-4 border-t pt-4">
          <ModuleField
            id="edit-reason"
            label="Motivo de edición"
            error={errors.reason?.message}
            disabled={mutation.isPending}
            {...register('reason')}
          />
          <p className="text-body-sm text-muted-foreground">
            Si los datos cambiaron o el resultado es incierto, revisa el detalle y carga los datos
            actuales. Esto reemplaza el formulario.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="submit" disabled={mutation.isPending || mutation.isSuccess}>
            {mutation.isPending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => {
              setBaseline(module);
              reset({ name: module.name, municipality: module.municipality, reason: '' });
              mutation.reset();
            }}
          >
            Cargar datos del detalle
          </Button>
        </div>
      </form>
    </section>
  );
}
