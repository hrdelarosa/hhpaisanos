import { createContext, useContext } from 'react';
import type { AuthUser, LoginInput, PasswordInput } from '../schemas/auth';

export type Session = {
  status: 'loading' | 'error' | 'anonymous' | 'authenticated' | 'logoutFailed';
  user: AuthUser | null;
  notice: string;
  actionError: string;
  busy: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (input: PasswordInput) => Promise<void>;
  recheck: () => void;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('SessionProvider is required');
  return session;
}
