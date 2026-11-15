import type { QueryClient } from '@tanstack/react-query';
import { HttpError } from '../../../lib/http';
import { sessionIdentity } from '../../auth/api/session-runtime';
import type { AuthUser } from '../../auth/schemas/auth';
import {
  captureInputSchema,
  type CaptureInput,
  type CaptureOperation,
  type CaptureResult,
} from '../schemas/capture';
import { requestLocation } from '../utils/geolocation';
import { captureAttendance, terminalCaptureCodes } from './capture';

type CaptureState = {
  phase:
    | 'idle'
    | 'locating'
    | 'submitting'
    | 'uncertain'
    | 'authorization'
    | 'conflict'
    | 'failed'
    | 'success';
  message: string;
  operation?: CaptureOperation;
  date?: string;
  assignmentId?: string;
  result?: CaptureResult;
};
type Request = { operation: CaptureOperation; key: string; input: CaptureInput };
type Entry = { state: CaptureState; request?: Request };
const idle: CaptureState = { phase: 'idle', message: '' };
const terminalMessages: Record<string, string> = {
  day_changed:
    'El servidor rechazó esta solicitud porque cambió la fecha civil. Actualiza el contexto antes de iniciar otra captura.',
  initial_mark_exists:
    'El servidor rechazó esta solicitud porque ya existe una marca inicial. Consulta los registros actualizados.',
  invalid_order:
    'El servidor rechazó esta solicitud por el orden de entrada y salida. Consulta los registros actualizados.',
  ineligible:
    'El servidor rechazó esta solicitud porque la asignación o el perfil ya no son elegibles.',
};

/** App-lifetime memory only. Public snapshots and MutationCache never contain GPS or request bodies. */
export class CaptureRuntime {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private active?: { userId: string; identity: string; client: QueryClient };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getState = (userId: string) => this.entries.get(userId)?.state ?? idle;
  private publish(userId: string, entry: Entry) {
    this.entries.set(userId, entry);
    this.listeners.forEach((listener) => listener());
  }

  setSession(user: AuthUser | null, client: QueryClient) {
    const allowed =
      user?.role === 'OBSERVADOR' &&
      !user.mustChangePassword &&
      user.permissions.includes('attendance:capture-own') &&
      user.permissions.includes('attendance:read-own');
    const identity = allowed ? sessionIdentity(user) : null;
    if (identity !== this.active?.identity || client !== this.active?.client)
      this.active = allowed ? { userId: user.id, identity: identity!, client } : undefined;
  }

  start = async (
    userId: string,
    operation: CaptureOperation,
    assignmentId: string,
    date: string,
  ) => {
    const ticket = this.active;
    const previous = this.entries.get(userId);
    if (
      !ticket ||
      ticket.userId !== userId ||
      previous?.request ||
      ['locating', 'submitting'].includes(previous?.state.phase ?? '')
    )
      return;
    const state: CaptureState = {
      phase: 'locating',
      message: 'Solicitando ubicación…',
      operation,
      date,
      assignmentId,
    };
    this.publish(userId, { state });
    let key: string;
    try {
      key = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    } catch {
      this.publish(userId, {
        state: {
          ...state,
          phase: 'failed',
          message: 'No se pudo preparar una solicitud segura. No se envió la captura.',
        },
      });
      return;
    }
    const location = await requestLocation();
    const active = this.active;
    if (active?.identity !== ticket.identity) {
      this.publish(userId, {
        state: {
          ...state,
          phase: 'failed',
          message:
            'La sesión cambió mientras se solicitaba ubicación. No se envió la captura; vuelve a consultar el contexto.',
        },
      });
      return;
    }
    const parsed = captureInputSchema.safeParse({ assignmentId, expectedDate: date, location });
    if (!parsed.success) {
      this.publish(userId, {
        state: {
          ...state,
          phase: 'failed',
          message:
            'El contexto de captura no es válido. Actualiza la asistencia. No se envió la captura.',
        },
      });
      return;
    }
    const request = Object.freeze({
      operation,
      key,
      input: Object.freeze({
        ...parsed.data,
        location: Object.freeze(parsed.data.location),
      }),
    });
    this.publish(userId, { state, request });
    await this.submit(userId, active.client);
  };

  retry = async (userId: string) => {
    if (this.active?.userId !== userId) return;
    const entry = this.entries.get(userId);
    if (!entry?.request || entry.state.phase === 'submitting') return;
    await this.submit(userId, this.active.client);
  };

  private refresh(userId: string, client: QueryClient) {
    void client.invalidateQueries({ queryKey: ['attendance'] });
    if (this.active?.userId === userId && this.active.client !== client)
      void this.active.client.invalidateQueries({ queryKey: ['attendance'] });
  }

  private async submit(userId: string, client: QueryClient) {
    const entry = this.entries.get(userId)!;
    const request = entry.request!;
    this.publish(userId, {
      ...entry,
      state: { ...entry.state, phase: 'submitting', message: 'Enviando captura al servidor…' },
    });
    const mutation = client.getMutationCache().build(client, {
      mutationKey: ['attendance', 'capture'],
      retry: false,
      gcTime: 0,
      // No evidence in mutation variables, data, context, metadata or errors.
      mutationFn: () => captureAttendance(request.operation, request.key, request.input),
    });
    try {
      const result = await mutation.execute(undefined);
      this.publish(userId, {
        state: {
          ...entry.state,
          phase: 'success',
          message: 'Solicitud confirmada por el servidor.',
          result,
        },
      });
      this.refresh(userId, client);
    } catch (error) {
      const status = error instanceof HttpError ? error.status : undefined;
      const code = error instanceof HttpError ? error.code : undefined;
      const terminal =
        (status === 409 || status === 403) && terminalCaptureCodes.includes(code ?? '');
      // A later validation rejection cannot establish the outcome of an earlier uncertain send.
      const invalid = status === 400 && entry.state.phase === 'locating';
      const phase =
        terminal || invalid
          ? 'failed'
          : status === 401 || status === 403
            ? 'authorization'
            : status === 409
              ? 'conflict'
              : 'uncertain';
      const message = terminal
        ? terminalMessages[code!]
        : invalid
          ? 'El servidor rechazó los datos de esta solicitud. Actualiza el contexto antes de intentar otra captura.'
          : status === 400
            ? 'El servidor rechazó este reintento, pero eso no confirma el resultado del envío anterior. Conservamos la solicitud original; consulta las marcas actuales y solicita soporte si el rechazo persiste.'
            : phase === 'authorization'
              ? 'La solicitud no está autorizada. Conservamos el intento en memoria para esta cuenta; verifica tu sesión y permisos antes de reintentarlo.'
              : phase === 'conflict'
                ? 'El servidor informó un conflicto no terminal. Actualiza la consulta y reintenta únicamente esta misma solicitud.'
                : 'No se pudo confirmar si la captura quedó registrada. Conservamos la solicitud en memoria. Reintentar enviará exactamente el mismo intento, sin volver a solicitar ubicación.';
      this.publish(userId, {
        state: { ...entry.state, phase, message },
        request: terminal || invalid ? undefined : request,
      });
      this.refresh(userId, client);
    } finally {
      client.getMutationCache().remove(mutation);
    }
  }
}
