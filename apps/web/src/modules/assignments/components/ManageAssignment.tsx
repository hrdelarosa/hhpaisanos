import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/button';
import { HttpError } from '../../../lib/http';
import { useSession } from '../../auth/hooks/use-session';
import { operativeQuery } from '../../operatives/api/operatives';
import { assignmentQuery, assignmentsKey, modifyAssignment } from '../api/assignments';
import {
  actionSchema,
  type Assignment,
  type AssignmentAction,
  type Operation,
} from '../schemas/assignments';
import { assignmentError } from '../utils/feedback';
import { readResources, sameSnapshot } from '../utils/preflight';
import { AssignmentField } from './AssignmentField';
import { ResourcePicker } from './ResourcePicker';

const labels = {
  change: 'Cambiar condiciones',
  terminate: 'Finalizar asignación',
  cancel: 'Cancelar asignación',
};
export function ManageAssignment({ assignment }: { assignment: Assignment }) {
  const { user } = useSession();
  const client = useQueryClient();
  const canUpdate = Boolean(user?.permissions.includes('assignments:update'));
  const canCancel = Boolean(user?.permissions.includes('assignments:cancel'));
  const [operation, setOperation] = useState<Operation>(canUpdate ? 'change' : 'cancel');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [notice, setNotice] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [replacementId, setReplacementId] = useState('');
  const schema = actionSchema.superRefine((v, context) => {
    if (operation === 'change') {
      if (!v.effectiveFrom)
        context.addIssue({
          code: 'custom',
          path: ['effectiveFrom'],
          message: 'Escribe la fecha efectiva.',
        });
      if (!v.attentionModuleId && !v.startTime && !v.endTime)
        context.addIssue({
          code: 'custom',
          path: ['attentionModuleId'],
          message: 'Selecciona al menos una condición nueva.',
        });
      if ((v.startTime || assignment.startTime) >= (v.endTime || assignment.endTime))
        context.addIssue({
          code: 'custom',
          path: ['endTime'],
          message: 'La salida debe ser posterior a la entrada.',
        });
    }
    if (operation === 'terminate' && !v.lastValidDate)
      context.addIssue({
        code: 'custom',
        path: ['lastValidDate'],
        message: 'Escribe el último día válido.',
      });
  });
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<AssignmentAction>({
    resolver: zodResolver(schema),
    defaultValues: {
      reason: '',
      effectiveFrom: '',
      lastValidDate: '',
      attentionModuleId: '',
      startTime: '',
      endTime: '',
    },
  });
  const selectedModule = useWatch({ control, name: 'attentionModuleId' });
  async function preflight(input: AssignmentAction) {
    try {
      await client.cancelQueries({
        queryKey: assignmentQuery(assignment.id).queryKey,
        exact: true,
      });
      const current = await client.fetchQuery({ ...assignmentQuery(assignment.id), staleTime: 0 });
      if (!sameSnapshot(current, assignment)) throw new Error('state_changed');
      await client.cancelQueries({
        queryKey: operativeQuery(current.operativeId).queryKey,
        exact: true,
      });
      const operative = await client.fetchQuery({
        ...operativeQuery(current.operativeId),
        staleTime: 0,
      });
      const resources =
        operation === 'change'
          ? await readResources(client, {
              ...current,
              attentionModuleId: input.attentionModuleId || current.attentionModuleId,
            })
          : null;
      return { current, operative, resources };
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) throw error;
      if (error instanceof Error && ['state_changed', 'ineligible'].includes(error.message))
        throw error;
      throw new Error('preflight_failed');
    }
  }
  const [confirmation, setConfirmation] = useState<{
    input: AssignmentAction;
    snapshot: Awaited<ReturnType<typeof preflight>>;
    operation: Operation;
  } | null>(null);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      const snapshot = await preflight(confirmed.input);
      if (!sameSnapshot(snapshot, confirmed.snapshot)) throw new Error('state_changed');
      const { input } = confirmed;
      const body: Record<string, unknown> = {
        reason: input.reason,
        expectedVersion: confirmed.snapshot.current.version,
      };
      if (confirmed.operation === 'terminate') body.lastValidDate = input.lastValidDate;
      if (confirmed.operation === 'change') {
        body.effectiveFrom = input.effectiveFrom;
        for (const key of ['attentionModuleId', 'startTime', 'endTime'] as const)
          if (input[key]) body[key] = input[key];
      }
      return modifyAssignment(assignment.id, confirmed.operation, body);
    },
    onSuccess: (replacement) => {
      setReplacementId(replacement?.id ?? '');
      setNotice(
        'Operación confirmada por el servidor. Consulta los períodos actualizados; una respuesta sin nuevo período puede ser una operación sin cambios.',
      );
    },
    onError: (error) => setNotice(assignmentError(error, true)),
    onSettled: async () => {
      setConfirmation(null);
      setBlocked(true);
      reset();
      await Promise.all([
        client.invalidateQueries({ queryKey: assignmentsKey }),
        client.invalidateQueries({ queryKey: ['attendance'] }),
      ]);
      lock.current = false;
    },
  });
  if (!canUpdate && !canCancel) return null;
  if (!user?.permissions.includes('operatives:read'))
    return (
      <p role="alert">Se requiere operatives:read para revalidar el operativo antes de actuar.</p>
    );
  const readsAllowed =
    operation !== 'change' ||
    ['observers:read', 'attention-modules:read'].every((p) => user.permissions.includes(p));
  return (
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">Gestionar período</h2>
      {notice && <p role={mutation.isSuccess ? 'status' : 'alert'}>{notice}</p>}
      {replacementId && (
        <Link
          className="inline-flex min-h-touch items-center break-all text-primary underline"
          to={`/asignaciones/${replacementId}`}
        >
          Consultar nuevo período {replacementId}
        </Link>
      )}
      {blocked ? (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            try {
              await client.fetchQuery({ ...assignmentQuery(assignment.id), staleTime: 0 });
              setBlocked(false);
              mutation.reset();
            } catch (error) {
              setNotice(assignmentError(error));
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          Consultar estado antes de otra intención
        </Button>
      ) : assignment.cancelledAt ? (
        <p>Asignación cancelada: se conserva para consulta, sin reactivación ni edición.</p>
      ) : confirmation ? (
        <section aria-label="Confirmación de operación" className="space-y-4">
          <h3 className="text-subheading">Confirmar: {labels[confirmation.operation]}</h3>
          <p className="break-all">
            Asignación {confirmation.snapshot.current.id} · versión{' '}
            {confirmation.snapshot.current.version}
          </p>
          {confirmation.operation === 'change' ? (
            <>
              <p>
                El servidor creará un nuevo período desde {confirmation.input.effectiveFrom} y
                acortará o cancelará el anterior. No se trasladan ni reescriben asistencias.
              </p>
              <p>
                Módulo: {confirmation.snapshot.resources?.module.name} · Entrada:{' '}
                {confirmation.input.startTime || assignment.startTime} · Salida:{' '}
                {confirmation.input.endTime || assignment.endTime}
              </p>
            </>
          ) : confirmation.operation === 'terminate' ? (
            <p>
              Último día válido inclusivo: {confirmation.input.lastValidDate}. Se conserva la
              asistencia histórica; no se puede recortar el pasado.
            </p>
          ) : (
            <p>
              Solo se cancelan períodos que aún no empiezan y no tienen asistencias. No se elimina
              el registro ni se puede reactivar.
            </p>
          )}
          <p className="break-words whitespace-pre-wrap">Motivo: {confirmation.input.reason}</p>
          <div className="flex flex-wrap gap-4">
            <Button
              variant={confirmation.operation === 'cancel' ? 'destructive' : 'primary'}
              disabled={mutation.isPending}
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                mutation.mutate(confirmation);
              }}
            >
              Confirmar operación
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirmation(null)}
            >
              Volver sin aplicar
            </Button>
          </div>
        </section>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(event) =>
            void handleSubmit(async (input) => {
              if (lock.current || !readsAllowed) return;
              lock.current = true;
              setBusy(true);
              setNotice('');
              try {
                setConfirmation({ input, snapshot: await preflight(input), operation });
              } catch (error) {
                setNotice(assignmentError(error));
                setBlocked(true);
              } finally {
                lock.current = false;
                setBusy(false);
              }
            })(event)
          }
        >
          <label className="block space-y-2" htmlFor="assignment-operation">
            Operación
            <select
              id="assignment-operation"
              className="min-h-touch w-full rounded-md border border-input bg-card px-3"
              disabled={busy}
              value={operation}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'change' || value === 'terminate' || value === 'cancel') {
                  setOperation(value);
                  reset();
                }
              }}
            >
              {canUpdate && (
                <>
                  <option value="change">Cambiar condiciones</option>
                  <option value="terminate">Finalizar asignación</option>
                </>
              )}
              {canCancel && <option value="cancel">Cancelar asignación</option>}
            </select>
          </label>
          {operation === 'change' && (
            <>
              <p>
                Solo desde un día futuro dentro del período. Deja vacías las condiciones que no
                cambian. Observador y operativo son inmutables.
              </p>
              <AssignmentField
                id="effectiveFrom"
                label="Cambio efectivo desde"
                type="date"
                disabled={busy}
                error={errors.effectiveFrom?.message}
                {...register('effectiveFrom')}
              />
              <ResourcePicker
                kind="module"
                value={selectedModule}
                disabled={busy}
                onChange={(v) => setValue('attentionModuleId', v, { shouldValidate: true })}
                error={errors.attentionModuleId?.message}
              />
              {(['startTime', 'endTime'] as const).map((field) => (
                <AssignmentField
                  key={field}
                  id={`change-${field}`}
                  label={field === 'startTime' ? 'Nueva hora de entrada' : 'Nueva hora de salida'}
                  type="time"
                  step={1}
                  disabled={busy}
                  error={errors[field]?.message}
                  {...register(field, {
                    setValueAs: (v: string) => (v.length === 5 ? `${v}:00` : v),
                  })}
                />
              ))}
            </>
          )}
          {operation === 'terminate' && (
            <AssignmentField
              id="lastValidDate"
              label="Último día válido"
              type="date"
              disabled={busy}
              error={errors.lastValidDate?.message}
              {...register('lastValidDate')}
            />
          )}
          <AssignmentField
            id="assignment-reason"
            label="Motivo administrativo"
            disabled={busy}
            error={errors.reason?.message}
            {...register('reason')}
          />
          {!readsAllowed && (
            <p role="alert">
              Se requieren observers:read y attention-modules:read para revalidar un cambio.
            </p>
          )}
          <Button type="submit" disabled={busy || !readsAllowed}>
            Revisar operación
          </Button>
        </form>
      )}
    </section>
  );
}
