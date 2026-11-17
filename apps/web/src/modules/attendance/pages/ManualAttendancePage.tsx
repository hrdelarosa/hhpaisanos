import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useInvalidFieldFocus } from '../../../hooks/use-invalid-field-focus';
import { fieldErrorAttributes } from '../../../lib/field-error';
import { useSession } from '../../auth/hooks/use-session';
import { assignmentQuery, listAssignments } from '../../assignments/api/assignments';
import { ResourcePicker } from '../../assignments/components/ResourcePicker';
import { operativeQuery } from '../../operatives/api/operatives';
import { listAdministrativeAttendance, manualAttendance } from '../api/administration';
import { manualInputSchema, missingLocationLabels, type ManualInput } from '../schemas/historical';
import { administrativeAttendanceError } from '../utils/administration';

export function ManualAttendancePage() {
  const id = useId();
  const { formRef, prepareInvalidFocus } = useInvalidFieldFocus();
  const { user } = useSession();
  const client = useQueryClient();
  const lock = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const [operativeId, setOperativeId] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [notice, setNotice] = useState('');
  const [resultId, setResultId] = useState('');
  const [confirmation, setConfirmation] = useState<{ input: ManualInput; snapshot: string } | null>(
    null,
  );
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<ManualInput>({
    resolver: zodResolver(manualInputSchema),
    shouldFocusError: false,
    defaultValues: {
      observerId: '',
      assignmentId: '',
      date: '',
      type: 'entrada',
      officialTimestamp: '',
      reason: '',
    },
  });
  const observerId = useWatch({ control, name: 'observerId' });
  const assignmentId = useWatch({ control, name: 'assignmentId' });
  const allowed = Boolean(user?.permissions.includes('attendance:capture-manual'));
  const catalogs = ['assignments:read', 'observers:read', 'operatives:read'].every((p) =>
    user?.permissions.includes(p),
  );
  const periods = useQuery({
    queryKey: ['assignments', 'manual-attendance-picker', observerId, operativeId, page],
    queryFn: ({ signal }) =>
      listAssignments(
        {
          observerId,
          operativeId,
          attentionModuleId: '',
          applicableOn: '',
          from: '',
          to: '',
          cancelled: '',
          page,
          limit: 20,
        },
        signal,
      ),
    enabled: allowed && catalogs && Boolean(observerId && operativeId),
  });
  const historicalSelectionAvailable = Boolean(observerId && operativeId && periods.isSuccess);
  const errorAttributes = (field: keyof ManualInput) =>
    fieldErrorAttributes(`${id}-${field}-error`, errors[field]?.message);
  async function preflight(input: ManualInput, expected?: string) {
    try {
      await client.cancelQueries({
        queryKey: assignmentQuery(input.assignmentId).queryKey,
        exact: true,
      });
      if (!active.current) throw new Error('preflight_failed');
      const assignment = await client.fetchQuery({
        ...assignmentQuery(input.assignmentId),
        staleTime: 0,
      });
      if (!active.current) throw new Error('preflight_failed');
      await client.cancelQueries({
        queryKey: operativeQuery(assignment.operativeId).queryKey,
        exact: true,
      });
      if (!active.current) throw new Error('preflight_failed');
      const operative = await client.fetchQuery({
        ...operativeQuery(assignment.operativeId),
        staleTime: 0,
      });
      if (!active.current) throw new Error('preflight_failed');
      if (
        assignment.observerId !== input.observerId ||
        assignment.operativeId !== operativeId ||
        assignment.cancelledAt !== null ||
        input.date < assignment.validFrom ||
        input.date > assignment.validTo ||
        input.date < operative.startDate ||
        input.date > operative.endDate ||
        !['activo', 'cerrado'].includes(operative.status) ||
        operative.arrivalToleranceMinutes === null
      )
        throw new Error('state_changed');
      const marks = await listAdministrativeAttendance(
        {
          observerId: input.observerId,
          operativeId,
          moduleId: '',
          from: input.date,
          to: input.date,
          reviewStatus: '',
          anomaly: '',
          page: 1,
          limit: 100,
        },
        new AbortController().signal,
      );
      if (!active.current) throw new Error('preflight_failed');
      const relevant = marks.items.filter((mark) => mark.assignmentId === assignment.id);
      if (marks.total > 100 || relevant.some((mark) => mark.type === input.type))
        throw new Error('state_changed');
      const other = relevant.find((mark) => !['rejected', 'annulled'].includes(mark.reviewStatus));
      if (
        other &&
        (input.type === 'entrada'
          ? input.officialTimestamp >= other.officialTimestamp
          : input.officialTimestamp <= other.officialTimestamp)
      )
        throw new Error('state_changed');
      const snapshot = JSON.stringify([assignment, operative, relevant]);
      if (expected && snapshot !== expected) throw new Error('state_changed');
      return snapshot;
    } catch (error) {
      if (error instanceof Error && error.message === 'state_changed') throw error;
      throw new Error('preflight_failed');
    }
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      await preflight(confirmed.input, confirmed.snapshot);
      return manualAttendance(confirmed.input);
    },
    onSuccess: (result) => {
      setResultId(result.id);
      setNotice(
        'Captura manual confirmada por el servidor: aceptada administrativamente, sin evidencia GPS ni certificación de presencia física.',
      );
    },
    onError: (error) => setNotice(administrativeAttendanceError(error, true)),
    onSettled: async () => {
      setEnded(true);
      setConfirmation(null);
      await client.invalidateQueries({ queryKey: ['attendance'] });
      lock.current = false;
    },
  });
  if (!allowed) return <p role="alert">No tienes permiso para captura manual.</p>;
  if (!catalogs)
    return (
      <p role="alert">
        Se requieren assignments:read, observers:read y operatives:read para seleccionar y revalidar
        el contexto histórico.
      </p>
    );
  return (
    <div className="max-w-form space-y-4">
      <Link
        className="inline-flex min-h-touch items-center text-primary underline"
        to="/asistencias"
      >
        Volver a asistencias
      </Link>
      <h1 className="text-heading">Captura manual de asistencia</h1>
      <p>
        Registro administrativo, no captura del observador. No solicita ni fabrica GPS. La API
        valida que la hora no sea futura y pertenezca a la fecha civil en America/Mexico_City, al
        periodo histórico y al orden entrada/salida. Puede completarse primero cualquiera de las dos
        marcas.
      </p>
      {notice && <p role={mutation.isSuccess ? 'status' : 'alert'}>{notice}</p>}
      {resultId && (
        <Link
          className="inline-flex min-h-touch items-center text-primary underline"
          to={`/asistencias/${resultId}`}
        >
          Consultar registro manual
        </Link>
      )}
      {ended ? (
        <p>
          Esta intención terminó. Consulta las asistencias antes de crear otra. No hay reenvío
          automático ni confirmación por lecturas posteriores.
        </p>
      ) : confirmation ? (
        <section
          aria-label="Confirmación de captura manual"
          className="space-y-4 rounded-lg border bg-card p-4 sm:p-6"
        >
          <h2 className="text-heading-sm">Confirmar captura manual</h2>
          <p className="break-all">
            Observador: {confirmation.input.observerId} · Asignación:{' '}
            {confirmation.input.assignmentId} · Operativo: {operativeId}
          </p>
          <p>
            {confirmation.input.date} · {confirmation.input.type} · Hora UTC:{' '}
            {confirmation.input.officialTimestamp}
          </p>
          <p>
            Sin ubicación: {missingLocationLabels[confirmation.input.missingLocationReason]}. Se
            creará una versión inicial aceptada administrativamente.
          </p>
          <p className="break-words whitespace-pre-wrap">Motivo: {confirmation.input.reason}</p>
          <div className="flex flex-wrap gap-4">
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                mutation.mutate(confirmation);
              }}
            >
              Confirmar captura manual
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
                const snapshot = await preflight(input);
                setConfirmation({ input, snapshot });
              } catch (error) {
                setNotice(administrativeAttendanceError(error));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }, prepareInvalidFocus())(event)
          }
        >
          <ResourcePicker
            kind="observer"
            error={errors.observerId?.message}
            value={observerId}
            disabled={busy}
            onChange={(id) => {
              setValue('observerId', id, { shouldValidate: true });
              setValue('assignmentId', '');
              setPage(1);
            }}
          />
          <ResourcePicker
            kind="operative"
            error={!historicalSelectionAvailable ? errors.assignmentId?.message : undefined}
            value={operativeId}
            disabled={busy}
            onChange={(id) => {
              setOperativeId(id);
              setValue('assignmentId', '');
              setPage(1);
            }}
          />
          {observerId &&
            operativeId &&
            (periods.isPending ? (
              <output>Cargando asignaciones históricas.</output>
            ) : periods.isError ? (
              <div role="alert">
                <p>No se pudieron consultar asignaciones.</p>
                <Button type="button" variant="secondary" onClick={() => void periods.refetch()}>
                  Reintentar asignaciones
                </Button>
              </div>
            ) : (
              <fieldset disabled={busy} className="space-y-2">
                {assignmentId && (
                  <p className="break-all">Asignación seleccionada: {assignmentId}</p>
                )}
                <label className="block">
                  Asignación histórica
                  <select
                    {...errorAttributes('assignmentId')}
                    className="min-h-touch w-full min-w-0 rounded-md border border-input bg-card px-3"
                    {...register('assignmentId')}
                  >
                    <option value="">Selecciona una asignación</option>
                    {periods.data.items.map((v) => (
                      <option key={v.id} value={v.id} disabled={v.cancelledAt !== null}>
                        {v.validFrom} — {v.validTo} · {v.startTime} — {v.endTime} · {v.id}
                        {v.cancelledAt ? ' · Cancelada' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {!periods.data.items.length && <p>No hay asignaciones en esta página.</p>}
                <div className="flex flex-wrap gap-4">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page === 1}
                    onClick={() => {
                      setValue('assignmentId', '');
                      setPage(page - 1);
                    }}
                  >
                    Asignaciones anteriores
                  </Button>
                  <span>Página {page}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={page * 20 >= periods.data.total}
                    onClick={() => {
                      setValue('assignmentId', '');
                      setPage(page + 1);
                    }}
                  >
                    Más asignaciones
                  </Button>
                </div>
              </fieldset>
            ))}
          <label className="block space-y-2" htmlFor={`${id}-date`}>
            Fecha civil de asistencia
            <Input
              id={`${id}-date`}
              type="date"
              disabled={busy}
              {...errorAttributes('date')}
              {...register('date')}
            />
          </label>
          <label className="block space-y-2">
            Tipo de marca
            <select
              {...errorAttributes('type')}
              className="min-h-touch w-full rounded-md border border-input bg-card px-3"
              disabled={busy}
              {...register('type')}
            >
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
            </select>
          </label>
          <label className="block space-y-2" htmlFor={`${id}-timestamp`}>
            Hora oficial UTC (YYYY-MM-DDTHH:mm:ss.ffffffZ)
            <Input
              id={`${id}-timestamp`}
              disabled={busy}
              {...errorAttributes('officialTimestamp')}
              {...register('officialTimestamp')}
            />
          </label>
          <label className="block space-y-2">
            Motivo de falta de ubicación
            <select
              {...errorAttributes('missingLocationReason')}
              className="min-h-touch w-full rounded-md border border-input bg-card px-3"
              disabled={busy}
              {...register('missingLocationReason')}
            >
              <option value="">Selecciona el motivo real</option>
              {Object.entries(missingLocationLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2" htmlFor={`${id}-reason`}>
            Motivo administrativo de captura
            <Input
              id={`${id}-reason`}
              disabled={busy}
              {...errorAttributes('reason')}
              {...register('reason')}
            />
          </label>
          {Object.entries(errors)
            .filter(
              ([key]) =>
                key !== 'observerId' && (key !== 'assignmentId' || historicalSelectionAvailable),
            )
            .map(([key, error]) => (
              <p key={key} id={`${id}-${key}-error`}>
                {error.message}
              </p>
            ))}
          <Button type="submit" disabled={busy}>
            Revisar captura manual
          </Button>
        </form>
      )}
    </div>
  );
}
