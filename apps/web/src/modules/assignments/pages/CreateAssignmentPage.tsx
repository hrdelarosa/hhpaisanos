import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/button';
import { useInvalidFieldFocus } from '../../../hooks/use-invalid-field-focus';
import { HttpError } from '../../../lib/http';
import { useSession } from '../../auth/hooks/use-session';
import { assignmentsKey, createAssignment } from '../api/assignments';
import { AssignmentField } from '../components/AssignmentField';
import { ResourcePicker, resources } from '../components/ResourcePicker';
import { createAssignmentSchema, type CreateAssignment } from '../schemas/assignments';
import { assignmentError } from '../utils/feedback';
import { readResources, sameSnapshot } from '../utils/preflight';

export function CreateAssignmentPage() {
  const id = useId();
  const { formRef, prepareInvalidFocus } = useInvalidFieldFocus();
  const { user } = useSession();
  const client = useQueryClient();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    input: CreateAssignment;
    snapshot: Awaited<ReturnType<typeof readResources>>;
  } | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateAssignment>({
    resolver: zodResolver(createAssignmentSchema),
    shouldFocusError: false,
    defaultValues: {
      operativeId: '',
      observerId: '',
      attentionModuleId: '',
      validFrom: '',
      validTo: '',
      startTime: '',
      endTime: '',
    },
  });
  const values = useWatch({ control });
  const [createdId, setCreatedId] = useState('');
  async function preflight(input: CreateAssignment) {
    try {
      return await readResources(client, input);
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) throw error;
      if (error instanceof Error && error.message === 'ineligible') throw error;
      throw new Error('preflight_failed');
    }
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      const current = await preflight(confirmed.input);
      if (!sameSnapshot(current, confirmed.snapshot)) throw new Error('state_changed');
      return createAssignment(confirmed.input);
    },
    onSuccess: (assignment) => {
      setCreatedId(assignment.id);
      setNotice('Creación confirmada por el servidor.');
    },
    onError: (error) => setNotice(assignmentError(error, true)),
    onSettled: async () => {
      setConfirmation(null);
      setBlocked(true);
      await Promise.all([
        client.invalidateQueries({ queryKey: assignmentsKey }),
        client.invalidateQueries({ queryKey: ['attendance'] }),
      ]);
      lock.current = false;
    },
  });
  const allowed = Object.values(resources).every((r) => user?.permissions.includes(r.permission));
  if (!allowed)
    return (
      <p role="alert">
        Crear una asignación requiere lecturas autorizadas de observadores, operativos y módulos.
      </p>
    );
  return (
    <section className="max-w-form space-y-4">
      <h1 className="text-heading">Crear asignación</h1>
      <p>
        Selecciona recursos activos y un operativo borrador o activo. No se requiere cuenta
        vinculada para planificar; la captura de asistencia tiene requisitos adicionales.
      </p>
      {notice && <p role={mutation.isSuccess ? 'status' : 'alert'}>{notice}</p>}
      {blocked ? (
        <div className="space-y-4">
          {createdId && user?.permissions.includes('assignments:read') && (
            <Link
              className="inline-flex min-h-touch items-center break-all text-primary underline"
              to={`/asignaciones/${createdId}`}
            >
              Consultar asignación creada
            </Link>
          )}
          <p>
            Consulta las asignaciones antes de iniciar una nueva intención. Esta pantalla no reenvía
            la solicitud.
          </p>
        </div>
      ) : confirmation ? (
        <section
          aria-label="Confirmación de creación"
          className="space-y-4 rounded-lg border bg-card p-4"
        >
          <h2 className="text-heading-sm">Confirmar creación</h2>
          <p>
            {confirmation.snapshot.observer.firstNames} {confirmation.snapshot.observer.lastNames} ·{' '}
            {confirmation.snapshot.operative.name} · {confirmation.snapshot.module.name}
          </p>
          <p>
            {confirmation.input.validFrom} — {confirmation.input.validTo} ·{' '}
            {confirmation.input.startTime} — {confirmation.input.endTime}
          </p>
          <p>
            Se creará un período persistente. El servidor comprueba superposiciones y elegibilidad.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                mutation.mutate(confirmation);
              }}
            >
              Confirmar creación
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setConfirmation(null)}
            >
              Volver al formulario
            </Button>
          </div>
        </section>
      ) : (
        <form
          ref={formRef}
          noValidate
          className="space-y-4"
          onSubmit={(event) =>
            void handleSubmit(async (input) => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setNotice('');
              try {
                setConfirmation({ input, snapshot: await preflight(input) });
              } catch (error) {
                setNotice(assignmentError(error));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }, prepareInvalidFocus())(event)
          }
        >
          {(
            [
              ['observer', 'observerId'],
              ['operative', 'operativeId'],
              ['module', 'attentionModuleId'],
            ] as const
          ).map(([kind, field]) => (
            <ResourcePicker
              key={kind}
              kind={kind}
              value={values[field] ?? ''}
              disabled={busy}
              onChange={(value) => setValue(field, value, { shouldValidate: true })}
              error={errors[field]?.message}
            />
          ))}
          {(
            [
              ['validFrom', 'Inicio de vigencia', 'date'],
              ['validTo', 'Fin de vigencia', 'date'],
              ['startTime', 'Hora de entrada', 'time'],
              ['endTime', 'Hora de salida', 'time'],
            ] as const
          ).map(([field, label, type]) => (
            <AssignmentField
              key={field}
              id={`${id}-${field}`}
              label={label}
              type={type}
              step={type === 'time' ? 1 : undefined}
              disabled={busy}
              error={errors[field]?.message}
              {...register(field, {
                setValueAs: (value: string) =>
                  type === 'time' && value.length === 5 ? `${value}:00` : value,
              })}
            />
          ))}
          <Button type="submit" disabled={busy}>
            Revisar creación
          </Button>
        </form>
      )}
    </section>
  );
}
