import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useConfirmationFocus } from '../../../hooks/use-confirmation-focus';
import { HttpError } from '../../../lib/http';
import { useSession } from '../../auth/hooks/use-session';
import { administrativeDetailQuery, reviewAttendance } from '../api/administration';
import {
  reviewInputSchema,
  type AdministrativeDetail,
  type ReviewInput,
} from '../schemas/administration';
import { administrativeAttendanceError } from '../utils/administration';

const snapshot = (record: AdministrativeDetail) =>
  JSON.stringify({
    id: record.id,
    version: record.version,
    current: record.current,
    status: record.reviewStatus,
    timestamp: record.officialTimestamp,
  });

export function ReviewAttendance({ record }: { record: AdministrativeDetail }) {
  const section = useRef<HTMLElement>(null);
  const summary = useRef<HTMLHeadingElement>(null);
  const result = useRef<HTMLParagraphElement>(null);
  const requestFocus = useConfirmationFocus();
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
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<{ input: ReviewInput; snapshot: string } | null>(
    null,
  );
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReviewInput>({
    resolver: zodResolver(reviewInputSchema),
    defaultValues: { decision: 'accept', reason: '' },
  });
  async function preflight(expected = snapshot(record)) {
    let current: AdministrativeDetail;
    try {
      await client.cancelQueries({
        queryKey: administrativeDetailQuery(record.id).queryKey,
        exact: true,
      });
      if (!active.current) throw new Error('preflight_failed');
      current = await client.fetchQuery({ ...administrativeDetailQuery(record.id), staleTime: 0 });
    } catch (error) {
      if (error instanceof HttpError && error.status < 500) throw error;
      throw new Error('preflight_failed');
    }
    if (!active.current) throw new Error('preflight_failed');
    if (
      !current.current ||
      current.reviewStatus !== 'pending_review' ||
      snapshot(current) !== expected
    )
      throw new Error('state_changed');
    return current;
  }
  const mutation = useMutation({
    retry: false,
    mutationFn: async (confirmed: NonNullable<typeof confirmation>) => {
      const current = await preflight(confirmed.snapshot);
      return reviewAttendance(current.id, confirmed.input, current.version);
    },
    onSuccess: () =>
      setNotice('Decisión confirmada por el servidor. Las anomalías de captura se conservan.'),
    onError: (error) => setNotice(administrativeAttendanceError(error, true)),
    onSettled: async () => {
      setConfirmation(null);
      setBlocked(true);
      reset();
      await client.invalidateQueries({ queryKey: ['attendance'] });
      lock.current = false;
    },
  });
  if (!user?.permissions.includes('attendance:review')) return null;
  return (
    <section ref={section} className="max-w-form space-y-4 rounded-lg border bg-card p-4 sm:p-6">
      <h2 className="text-heading-sm">Revisión administrativa</h2>
      {notice && (
        <p ref={result} tabIndex={-1} role={mutation.isSuccess ? 'status' : 'alert'}>
          {notice}
        </p>
      )}
      {blocked ? (
        <Button
          variant="secondary"
          disabled={busy || mutation.isPending}
          onClick={async () => {
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            try {
              await client.fetchQuery({ ...administrativeDetailQuery(record.id), staleTime: 0 });
              setBlocked(false);
              mutation.reset();
            } catch (error) {
              setNotice(administrativeAttendanceError(error));
            } finally {
              lock.current = false;
              setBusy(false);
            }
          }}
        >
          Consultar estado antes de otra intención
        </Button>
      ) : !record.current || record.reviewStatus !== 'pending_review' ? (
        <p>
          Solo se pueden revisar registros vigentes pendientes. Este registro no admite revisión.
        </p>
      ) : confirmation ? (
        <section
          aria-label="Confirmación de revisión"
          className="space-y-4 rounded-md border bg-muted p-4"
        >
          <h3 ref={summary} tabIndex={-1} className="text-subheading">
            Confirmar {confirmation.input.decision === 'accept' ? 'aceptación' : 'rechazo'}
          </h3>
          <p className="break-all">
            Registro {record.id} · versión {record.version} · {record.date} · {record.type} ·{' '}
            {record.observerName}
          </p>
          <p>
            Hora oficial (UTC): {record.officialTimestamp}. La decisión no modifica la captura ni
            elimina anomalías y no certifica presencia física.
          </p>
          <p className="break-words whitespace-pre-wrap">Motivo: {confirmation.input.reason}</p>
          <div className="flex flex-wrap gap-4">
            <Button
              variant={confirmation.input.decision === 'reject' ? 'destructive' : 'primary'}
              disabled={mutation.isPending}
              onClick={() => {
                if (lock.current) return;
                requestFocus(() => result.current);
                lock.current = true;
                mutation.mutate(confirmation);
              }}
            >
              Confirmar decisión
            </Button>
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                requestFocus(() => section.current?.querySelector('#review-decision') ?? null);
                setConfirmation(null);
              }}
            >
              Volver sin aplicar
            </Button>
          </div>
        </section>
      ) : (
        <form
          noValidate
          className="space-y-6"
          onSubmit={(event) =>
            void handleSubmit(async (input) => {
              if (lock.current) return;
              requestFocus(() => summary.current ?? result.current);
              lock.current = true;
              setBusy(true);
              setNotice('');
              try {
                const current = await preflight();
                setConfirmation({ input, snapshot: snapshot(current) });
              } catch (error) {
                setNotice(administrativeAttendanceError(error));
                setBlocked(true);
              } finally {
                lock.current = false;
                setBusy(false);
              }
            })(event)
          }
        >
          <p className="rounded-md bg-warning-surface p-3 text-body-sm text-warning">
            Registro vigente · versión {record.version} · pendiente de revisión.
          </p>
          <label className="block space-y-2" htmlFor="review-decision">
            Decisión
            <select
              id="review-decision"
              className="min-h-touch w-full rounded-md border border-input bg-card px-3"
              disabled={busy}
              {...register('decision')}
            >
              <option value="accept">Aceptar</option>
              <option value="reject">Rechazar</option>
            </select>
          </label>
          <label className="block space-y-2" htmlFor="review-reason">
            Motivo de revisión
            <Input
              id="review-reason"
              disabled={busy}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? 'review-reason-error' : undefined}
              {...register('reason')}
            />
          </label>
          {errors.reason && (
            <p id="review-reason-error" role="alert">
              {errors.reason.message}
            </p>
          )}
          <div className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={busy}>
              Revisar decisión
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
