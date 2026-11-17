import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useInvalidFieldFocus } from '../../../hooks/use-invalid-field-focus';
import { fieldErrorAttributes } from '../../../lib/field-error';
import { useSession } from '../../auth/hooks/use-session';
import {
  administrativeDetailQuery,
  annulAttendance,
  correctAttendance,
} from '../api/administration';
import { reviewInputSchema, type AdministrativeDetail } from '../schemas/administration';
import {
  attendanceCivilDate,
  correctionInputSchema,
  type CorrectionInput,
} from '../schemas/historical';
import { administrativeAttendanceError } from '../utils/administration';

export function HistoricalAttendanceOperation({
  record,
  operation,
}: {
  record: AdministrativeDetail;
  operation: 'correct' | 'annul';
}) {
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
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [ended, setEnded] = useState(false);
  const [successor, setSuccessor] = useState('');
  const [confirmation, setConfirmation] = useState<{
    input: CorrectionInput;
    snapshot: string;
  } | null>(null);
  const correct = operation === 'correct';
  const label = correct ? 'Corrección' : 'Anulación';
  const schema = correct
    ? correctionInputSchema
    : z.object({ reason: reviewInputSchema.shape.reason, officialTimestamp: z.string() });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CorrectionInput>({
    resolver: zodResolver(schema),
    shouldFocusError: false,
    defaultValues: { reason: '', officialTimestamp: record.officialTimestamp },
  });
  const fingerprint = (v: AdministrativeDetail) =>
    JSON.stringify([v.id, v.version, v.current, v.reviewStatus, v.officialTimestamp, v.decision]);
  async function preflight(input: CorrectionInput, expected = fingerprint(record)) {
    try {
      await client.cancelQueries({
        queryKey: administrativeDetailQuery(record.id).queryKey,
        exact: true,
      });
      if (!active.current) throw new Error('preflight_failed');
      const fresh = await client.fetchQuery({
        ...administrativeDetailQuery(record.id),
        staleTime: 0,
      });
      if (!active.current) throw new Error('preflight_failed');
      if (fingerprint(fresh) !== expected || !fresh.current || fresh.reviewStatus === 'annulled')
        throw new Error('state_changed');
      if (correct && attendanceCivilDate(input.officialTimestamp) !== fresh.date)
        throw new Error('historical_date');
      return fresh;
    } catch (error) {
      if (error instanceof Error && ['state_changed', 'historical_date'].includes(error.message))
        throw error;
      throw new Error('preflight_failed');
    }
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      const { input } = confirmed;
      const fresh = await preflight(input, confirmed.snapshot);
      return correct
        ? correctAttendance(fresh.id, input, fresh.version)
        : annulAttendance(fresh.id, input.reason, fresh.version);
    },
    onSuccess: (result) => {
      setNotice(
        correct
          ? 'Corrección confirmada: nueva versión pendiente de revisión independiente.'
          : 'Anulación confirmada. El registro y su historial se conservan.',
      );
      if (correct) setSuccessor(result.id);
    },
    onError: (error) =>
      setNotice(
        error instanceof Error && error.message === 'historical_date'
          ? 'La hora debe conservar la fecha civil del registro en America/Mexico_City. No se envió la operación.'
          : administrativeAttendanceError(error, true),
      ),
    onSettled: async () => {
      setEnded(true);
      setConfirmation(null);
      await client.invalidateQueries({ queryKey: ['attendance'] });
      lock.current = false;
    },
  });
  if (!user?.permissions.includes(`attendance:${operation}`)) return null;
  return (
    <section className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">{label} administrativa</h2>
      {notice && <p role={mutation.isSuccess ? 'status' : 'alert'}>{notice}</p>}
      {successor && (
        <Link
          className="inline-flex min-h-touch items-center text-primary underline"
          to={`/asistencias/${successor}`}
        >
          Consultar nueva versión y revisión F7
        </Link>
      )}
      {ended ? (
        <p>
          Esta intención terminó. Consulta nuevamente el detalle antes de iniciar otra operación.
          Una lectura posterior no confirma un resultado incierto.
        </p>
      ) : !record.current ||
        record.reviewStatus === 'annulled' ||
        (correct && (record.version === 4294967295 || record.policyVersion !== 'personal-v1')) ? (
        <p>Este registro no admite esta operación.</p>
      ) : confirmation ? (
        <section aria-label={`Confirmación de ${label.toLowerCase()}`} className="space-y-4">
          <p className="break-all">
            Registro {record.id} · versión {record.version} · {record.date} · {record.type} ·{' '}
            {record.observerName}
          </p>
          <p className="break-words">Hora actual (UTC): {record.officialTimestamp}</p>
          {correct ? (
            <>
              <p className="break-words">
                Nueva hora (UTC): {confirmation.input.officialTimestamp}
              </p>
              <p>
                Se conservarán la versión original, el predecesor, GPS, actor y procedencia. La
                nueva versión quedará pendiente; no se acepta automáticamente.
              </p>
            </>
          ) : (
            <p>
              La anulación no elimina historia. Impide recrear o corregir esta marca y puede afectar
              su uso como entrada para una salida. No anula automáticamente la otra marca.
            </p>
          )}
          <p className="break-words whitespace-pre-wrap">Motivo: {confirmation.input.reason}</p>
          <div className="flex flex-wrap gap-4">
            <Button
              variant={correct ? 'primary' : 'destructive'}
              disabled={mutation.isPending}
              onClick={() => {
                if (lock.current) return;
                lock.current = true;
                mutation.mutate(confirmation);
              }}
            >
              Confirmar {label.toLowerCase()}
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
              try {
                const fresh = await preflight(input);
                setConfirmation({ input, snapshot: fingerprint(fresh) });
              } catch (error) {
                setNotice(
                  error instanceof Error && error.message === 'historical_date'
                    ? 'La hora debe conservar la fecha civil del registro en America/Mexico_City.'
                    : administrativeAttendanceError(error),
                );
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }, prepareInvalidFocus())(event)
          }
        >
          {correct && (
            <label className="block space-y-2" htmlFor={`${id}-timestamp`}>
              Nueva hora oficial UTC (YYYY-MM-DDTHH:mm:ss.ffffffZ)
              <Input
                id={`${id}-timestamp`}
                disabled={busy}
                {...fieldErrorAttributes(
                  `${id}-timestamp-error`,
                  errors.officialTimestamp?.message,
                )}
                {...register('officialTimestamp')}
              />
            </label>
          )}
          {errors.officialTimestamp && (
            <p id={`${id}-timestamp-error`}>{errors.officialTimestamp.message}</p>
          )}
          <label className="block space-y-2" htmlFor={`${id}-reason`}>
            Motivo de {label.toLowerCase()}
            <Input
              id={`${id}-reason`}
              disabled={busy}
              {...fieldErrorAttributes(`${id}-reason-error`, errors.reason?.message)}
              {...register('reason')}
            />
          </label>
          {errors.reason && <p id={`${id}-reason-error`}>{errors.reason.message}</p>}
          <Button disabled={busy} type="submit">
            Revisar {label.toLowerCase()}
          </Button>
        </form>
      )}
    </section>
  );
}
