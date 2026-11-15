import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/button';
import { activateOperative, operativeQuery, operativesKey } from '../api/operatives';
import { activationSchema, type ActivationInput, type Operative } from '../schemas/operatives';
import { operativeError } from '../utils/feedback';
import { OperativeField } from './OperativeField';

export function ActivateOperative({ operative }: { operative: Operative }) {
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState<{
    operative: Operative;
    input: ActivationInput;
  } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ActivationInput>({ resolver: zodResolver(activationSchema) });
  const readCurrent = () => client.fetchQuery({ ...operativeQuery(operative.id), staleTime: 0 });
  const mutation = useMutation({
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      const current = await readCurrent();
      if (
        current.status !== 'borrador' ||
        current.updatedAt !== confirmed.operative.updatedAt ||
        current.startDate !== confirmed.operative.startDate ||
        current.endDate !== confirmed.operative.endDate ||
        current.arrivalToleranceMinutes !== confirmed.operative.arrivalToleranceMinutes
      ) {
        throw new Error('state_changed');
      }
      await activateOperative(operative.id, confirmed.input);
    },
    onSuccess: () => setNotice('Activación confirmada por el servidor.'),
    onError: (error) =>
      setNotice(
        error instanceof Error && error.message === 'state_changed'
          ? 'El operativo cambió. Revisa el estado actual y vuelve a confirmar si corresponde.'
          : operativeError(error, true),
      ),
    onSettled: async () => {
      setConfirmation(null);
      await client.invalidateQueries({ queryKey: operativesKey });
    },
  });
  return (
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">Activación administrativa</h2>
      {notice && <p role={mutation.isSuccess ? 'status' : 'alert'}>{notice}</p>}
      {operative.status !== 'borrador' ? (
        <p>
          Solo se pueden activar operativos en borrador. La tolerancia no se puede modificar después
          de activar.
        </p>
      ) : confirmation ? (
        <section aria-labelledby="activation-confirm-title" className="space-y-4">
          <h3 id="activation-confirm-title" className="text-subheading">
            Confirmar activación
          </h3>
          <p>
            Se activará {confirmation.operative.name}, del {confirmation.operative.startDate} al{' '}
            {confirmation.operative.endDate}, en Guerrero.
          </p>
          <p>
            Tolerancia de llegada: {confirmation.input.arrivalToleranceMinutes} minutos. No podrá
            modificarse después.
          </p>
          <p className="whitespace-pre-wrap">Motivo: {confirmation.input.reason}</p>
          <p>
            El servidor validará el intervalo en America/Mexico_City y el estado vigente. No se
            puede cerrar ni reabrir desde esta pantalla.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                if (!mutation.isPending) mutation.mutate(confirmation);
              }}
            >
              {mutation.isPending ? 'Validando y activando…' : 'Confirmar activación'}
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
          onSubmit={handleSubmit(async (input) => {
            if (preparing || mutation.isPending) return;
            setPreparing(true);
            setNotice('');
            mutation.reset();
            try {
              const current = await readCurrent();
              if (current.status !== 'borrador')
                setNotice('El operativo ya no está en borrador. Revisa el estado actual.');
              else setConfirmation({ operative: current, input });
            } catch (error) {
              setNotice(operativeError(error));
            } finally {
              setPreparing(false);
            }
          })}
        >
          <p>
            Indica explícitamente la tolerancia configurada y un motivo administrativo. No hay
            tolerancia predeterminada. El servidor rechaza intervalos vencidos.
          </p>
          <OperativeField
            id="activation-tolerance"
            label="Tolerancia de llegada (minutos)"
            type="number"
            min={0}
            max={65535}
            step={1}
            error={errors.arrivalToleranceMinutes?.message}
            disabled={preparing || mutation.isPending}
            {...register('arrivalToleranceMinutes', { valueAsNumber: true })}
          />
          <OperativeField
            id="activation-reason"
            label="Motivo administrativo"
            error={errors.reason?.message}
            disabled={preparing || mutation.isPending}
            {...register('reason')}
          />
          <Button type="submit" disabled={preparing || mutation.isPending}>
            {preparing ? 'Consultando estado actual…' : 'Revisar activación'}
          </Button>
        </form>
      )}
    </section>
  );
}
