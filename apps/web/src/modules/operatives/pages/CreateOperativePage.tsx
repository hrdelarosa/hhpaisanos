import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
import { PageHeader } from '../../../components/page-header';
import { useSession } from '../../auth/hooks/use-session';
import { createOperative, operativesKey } from '../api/operatives';
import { OperativeField } from '../components/OperativeField';
import { createOperativeSchema, type CreateOperativeInput } from '../schemas/operatives';
import { operativeError } from '../utils/feedback';

export function CreateOperativePage() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { user } = useSession();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateOperativeInput>({ resolver: zodResolver(createOperativeSchema) });
  const mutation = useMutation({
    mutationFn: createOperative,
    onSuccess: async (operative) => {
      await client.invalidateQueries({ queryKey: operativesKey });
      if (user?.permissions.includes('operatives:read'))
        void navigate(`/operativos/${operative.id}`);
      else reset();
    },
  });
  return (
    <section className="max-w-form space-y-6">
      <PageHeader
        title="Crear operativo"
        description="El nuevo operativo inicia en borrador. La activación se realiza por separado."
      />
      {mutation.isError && <p role="alert">{operativeError(mutation.error, true)}</p>}
      {mutation.isSuccess && <output>Operativo creado en borrador.</output>}
      <form
        noValidate
        className="space-y-6 rounded-lg border bg-card p-4 sm:p-6"
        onSubmit={handleSubmit((input) => {
          if (!mutation.isPending) mutation.mutate(input);
        })}
      >
        <fieldset className="min-w-0 space-y-4">
          <legend className="mb-4 text-subheading">Datos del operativo</legend>
          <OperativeField
            id="operative-name"
            label="Nombre"
            error={errors.name?.message}
            disabled={mutation.isPending}
            {...register('name')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <OperativeField
              id="operative-start"
              label="Fecha inicial"
              type="date"
              min="1000-01-01"
              max="9999-12-31"
              error={errors.startDate?.message}
              disabled={mutation.isPending}
              {...register('startDate')}
            />
            <OperativeField
              id="operative-end"
              label="Fecha final"
              type="date"
              min="1000-01-01"
              max="9999-12-31"
              error={errors.endDate?.message}
              disabled={mutation.isPending}
              {...register('endDate')}
            />
          </div>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creando…' : 'Guardar borrador'}
          </Button>
        </div>
      </form>
    </section>
  );
}
