import type { QueryClient } from '@tanstack/react-query';
import { HttpError } from '../../../lib/http';
import { createQueryClient } from '../../../lib/query-client';
import type { AuthUser, LoginInput, PasswordInput } from '../schemas/auth';
import * as auth from './auth';

export type SessionScope = {
  client: QueryClient;
  revision: number;
  phase: 'checking' | 'ready' | 'signedOut' | 'signingOut' | 'logoutFailed';
  identity: string | null;
  notice: string;
};

export function sessionIdentity(user: AuthUser) {
  return JSON.stringify([
    user.id,
    user.role,
    [...user.permissions].sort(),
    user.mustChangePassword,
  ]);
}

/** One instance per mounted application; owns cache boundaries, never credentials. */
export class SessionRuntime {
  private revision = 0;
  private listeners = new Set<() => void>();
  private snapshot = { scope: this.makeScope('checking'), busy: false, actionError: '' };

  getSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(update: Partial<typeof this.snapshot>) {
    this.snapshot = { ...this.snapshot, ...update };
    this.listeners.forEach((listener) => listener());
  }

  private makeScope(phase: SessionScope['phase'], notice = '', user?: AuthUser): SessionScope {
    const client = createQueryClient((error) => {
      const scope = this.snapshot.scope;
      if (scope.client !== client || !(error instanceof HttpError)) return;
      if (error.status === 401) {
        this.replace(
          'signedOut',
          scope.identity
            ? 'La sesión expiró o fue revocada. Inicia sesión de nuevo.'
            : scope.notice,
        );
      } else if (error.status === 403 && error.code === 'PASSWORD_CHANGE_REQUIRED') {
        this.replace('checking');
      }
    });
    if (user) client.setQueryData(auth.sessionKey, user);
    return {
      client,
      revision: ++this.revision,
      phase,
      identity: user ? sessionIdentity(user) : null,
      notice,
    };
  }

  private replace(phase: SessionScope['phase'], notice = '', user?: AuthUser) {
    const previous = this.snapshot.scope;
    const next = this.makeScope(phase, notice, user);
    // Retain only the identity signature while rechecking, never its cached data.
    if (phase === 'checking') next.identity = previous.identity;
    const sameAction =
      phase === 'checking' || (phase === 'ready' && next.identity === previous.identity);
    this.publish({ scope: next, actionError: sameAction ? this.snapshot.actionError : '' });
    // Old callbacks keep only the discarded client, never the next account's cache.
    void previous.client.cancelQueries();
    previous.client.clear();
    return next;
  }

  accept = (user: AuthUser, client: QueryClient) => {
    if (this.snapshot.scope.client === client)
      this.replace('ready', this.snapshot.scope.notice, user);
  };

  recheck = () => {
    if (!this.snapshot.busy) this.replace('checking', this.snapshot.scope.notice);
  };

  login = (input: LoginInput) => this.run('login', () => auth.login(input));
  logout = () => this.run('logout', auth.logout);
  changePassword = (input: PasswordInput) => this.run('password', () => auth.changePassword(input));

  private async run(kind: 'login' | 'logout' | 'password', perform: () => Promise<void>) {
    if (this.snapshot.busy) return;
    this.publish({ busy: true, actionError: '' });
    const ticket =
      kind === 'password' || (kind === 'login' && this.snapshot.scope.phase === 'signedOut')
        ? this.snapshot.scope
        : this.replace(kind === 'logout' ? 'signingOut' : 'signedOut');
    try {
      // Deliberately bypass MutationCache: credential variables must not be retained.
      await perform();
      if (this.snapshot.scope !== ticket) return;
      this.replace(
        kind === 'login' ? 'checking' : 'signedOut',
        kind === 'password'
          ? 'Contraseña actualizada. Todas las sesiones se cerraron; inicia sesión de nuevo.'
          : kind === 'logout'
            ? 'Sesión cerrada.'
            : '',
      );
    } catch (error) {
      if (this.snapshot.scope !== ticket) return;
      if (kind === 'logout') {
        this.replace(
          'logoutFailed',
          'No se pudo confirmar el cierre de sesión en el servidor. Tu contenido privado está oculto; vuelve a intentar cerrar sesión.',
        );
      } else {
        const status = error instanceof HttpError ? error.status : undefined;
        this.publish({
          actionError:
            status === 429
              ? 'Demasiados intentos. Espera antes de volver a intentarlo.'
              : status === 403
                ? 'Solicitud rechazada. Verifica el origen y la protección de la solicitud.'
                : kind === 'login' && status === 401
                  ? 'Usuario o contraseña incorrectos, o cuenta no disponible.'
                  : kind === 'password' && status === 401
                    ? 'No se pudo cambiar la contraseña. Verifica la contraseña actual; se comprobará también la sesión.'
                    : status === 400
                      ? 'Revisa los datos de la solicitud.'
                      : 'No se pudo confirmar el resultado. Verifica la sesión antes de volver a enviar la solicitud.',
        });
        if (kind === 'password' && (status === 401 || status === undefined || status >= 500))
          this.replace('checking');
      }
    } finally {
      this.publish({ busy: false });
    }
  }
}
