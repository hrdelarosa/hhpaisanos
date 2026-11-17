import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/button';
import { useConfirmationFocus } from '../../../hooks/use-confirmation-focus';
import { changeModuleStatus, moduleQuery, modulesKey } from '../api/attention-modules';
import { statusSchema, type AttentionModule } from '../schemas/attention-modules';
import { moduleError, sameModule } from '../utils/feedback';
import { ModuleField } from './ModuleField';

export function ChangeModuleStatus({ module }: { module: AttentionModule }) {
  const section = useRef<HTMLElement>(null);
  const summary = useRef<HTMLHeadingElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const requestFocus = useConfirmationFocus();
  const client = useQueryClient();
  const [confirmation, setConfirmation] = useState<{
    module: AttentionModule;
    reason: string;
  } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<{ reason: string }>({ resolver: zodResolver(statusSchema) });
  const readCurrent = () => client.fetchQuery({ ...moduleQuery(module.id), staleTime: 0 });
  const mutation = useMutation({
    retry: false,
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      const current = await readCurrent();
      if (!sameModule(current, confirmed.module)) throw new Error('state_changed');
      await changeModuleStatus(module.id, {
        active: !confirmed.module.active,
        reason: confirmed.reason,
      });
    },
    onSuccess: () => {
      setNotice('Cambio de estado confirmado por el servidor.');
      reset();
    },
    onError: (error) => setNotice(moduleError(error, true)),
    onSettled: async () => {
      setConfirmation(null);
      await client.invalidateQueries({ queryKey: modulesKey });
    },
  });
  return (
    <section ref={section} className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">Disponibilidad del módulo</h2>
      {notice && (
        <p ref={result} tabIndex={-1} role={mutation.isSuccess ? 'status' : 'alert'}>
          {notice}
        </p>
      )}
      {confirmation ? (
        <section
          aria-labelledby="status-confirm-title"
          className="space-y-4 rounded-md border bg-muted p-4"
        >
          <h3 ref={summary} tabIndex={-1} id="status-confirm-title" className="text-subheading">
            Confirmar {confirmation.module.active ? 'desactivación' : 'activación'}
          </h3>
          <p>
            {confirmation.module.name} · {confirmation.module.municipality}. Estado actual:{' '}
            {confirmation.module.active ? 'Activo' : 'Inactivo'}.
          </p>
          <p>
            El módulo quedará {confirmation.module.active ? 'inactivo' : 'activo'}. No se modifican
            ni cancelan asignaciones y se conserva el historial.
          </p>
          {confirmation.module.active && (
            <p>
              La desactivación impide nuevas asignaciones y la captura personal que requiere un
              módulo activo.
            </p>
          )}
          <p className="whitespace-pre-wrap">Motivo: {confirmation.reason}</p>
          <div className="flex flex-wrap gap-4">
            <Button
              variant={confirmation.module.active ? 'destructive' : 'primary'}
              disabled={mutation.isPending}
              onClick={() => {
                if (!mutation.isPending) {
                  requestFocus(() => result.current);
                  mutation.mutate(confirmation);
                }
              }}
            >
              {mutation.isPending ? 'Validando y enviando…' : 'Confirmar cambio de estado'}
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                requestFocus(() => section.current?.querySelector('#status-reason') ?? null);
                setConfirmation(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </section>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) =>
            void handleSubmit(async ({ reason }) => {
              if (preparing || mutation.isPending) return;
              requestFocus(() => summary.current ?? result.current);
              setPreparing(true);
              setNotice('');
              mutation.reset();
              try {
                const current = await readCurrent();
                if (!sameModule(current, module))
                  setNotice(moduleError(new Error('state_changed')));
                else setConfirmation({ module: current, reason });
              } catch (error) {
                setNotice(moduleError(error));
              } finally {
                setPreparing(false);
              }
            })(event)
          }
        >
          <ModuleField
            id="status-reason"
            label="Motivo del cambio de estado"
            error={errors.reason?.message}
            disabled={preparing || mutation.isPending}
            {...register('reason')}
          />
          <Button type="submit" variant="secondary" disabled={preparing || mutation.isPending}>
            {preparing
              ? 'Consultando estado actual…'
              : module.active
                ? 'Revisar desactivación'
                : 'Revisar activación'}
          </Button>
        </form>
      )}
    </section>
  );
}
