import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
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
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h1 className="text-heading">Crear módulo de atención</h1>
      <p>El módulo se crea activo. El estado y las fechas son controlados por el servidor.</p>
      {mutation.isError && <p role="alert">{moduleError(mutation.error, true)}</p>}
      {mutation.isSuccess && <output>Módulo creado y activo, confirmado por el servidor.</output>}
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((input) => {
          if (!mutation.isPending) mutation.mutate(input);
        })}
      >
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
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creando…' : 'Guardar módulo'}
        </Button>
      </form>
    </section>
  );
}
