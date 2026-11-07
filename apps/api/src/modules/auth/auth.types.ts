import type { Request } from 'express';

export type AuthUser = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  permissions: string[];
  mustChangePassword: boolean;
};

export type AuthContext = { user: AuthUser; sessionId: string };
export type AuthRequest = Request & { auth?: AuthContext };
