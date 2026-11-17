import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/page-header';
import { useSession } from '../../auth/hooks/use-session';
import { createModule, modulesKey } from '../api/attention-modules';
import { ModuleField } from '../components/ModuleField';
import { createModuleSchema, type CreateModuleInput } from '../schemas/attention-modules';
import { moduleError } from '../utils/feedback';

export function CreateModulePage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateModuleInput>({ resolver: zodResolver(createModuleSchema) });
  const mutation = useMutation({
    mutationFn: createModule,
    retry: false,
    onSuccess: async (module) => {
      await client.invalidateQueries({ queryKey: modulesKey });
      if (user?.permissions.includes('attention-modules:read'))
        void navigate(`/modulos/${module.id}`);
      else reset();
    },
  });
  return (
    <section className="max-w-form space-y-6">
      <PageHeader
        title="Crear módulo de atención"
        description="El módulo se crea activo. El estado y las fechas son controlados por el servidor."
      />
      {mutation.isError && <p role="alert">{moduleError(mutation.error, true)}</p>}
      {mutation.isSuccess && <output>Módulo creado y activo, confirmado por el servidor.</output>}
      <form
        noValidate
        className="space-y-6 rounded-lg border bg-card p-4 sm:p-6"
        onSubmit={handleSubmit((input) => {
          if (!mutation.isPending) mutation.mutate(input);
        })}
      >
        <fieldset className="min-w-0 space-y-4">
          <legend className="mb-4 text-subheading">Datos del punto de atención</legend>
          <ModuleField
            id="module-name"
            label="Nombre"
            error={errors.name?.message}
            disabled={mutation.isPending}
            {...register('name')}
          />
          <ModuleField
            id="module-municipality"
            label="Municipio"
            error={errors.municipality?.message}
            disabled={mutation.isPending}
            {...register('municipality')}
          />
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creando…' : 'Guardar módulo'}
          </Button>
        </div>
      </form>
    </section>
  );
}
