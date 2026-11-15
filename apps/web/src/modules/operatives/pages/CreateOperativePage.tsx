import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/ui/button';
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
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h1 className="text-heading">Crear operativo</h1>
      <p>El nuevo operativo inicia en borrador. La activación se realiza por separado.</p>
      {mutation.isError && <p role="alert">{operativeError(mutation.error, true)}</p>}
      {mutation.isSuccess && <output>Operativo creado en borrador.</output>}
      <form
        noValidate
        className="space-y-4"
        onSubmit={handleSubmit((input) => {
          if (!mutation.isPending) mutation.mutate(input);
        })}
      >
        <OperativeField
          id="operative-name"
          label="Nombre"
          error={errors.name?.message}
          disabled={mutation.isPending}
          {...register('name')}
        />
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
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creando…' : 'Guardar borrador'}
        </Button>
      </form>
    </section>
  );
}
