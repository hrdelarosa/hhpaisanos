import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_CONFIG, type AuthConfig } from '../auth.config.js';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    if (
      request.get('X-HHP-CSRF') !== '1' ||
      !request.is('application/json') ||
      !this.config.origins.includes(request.get('Origin') ?? '')
    )
      throw new ForbiddenException('Invalid request origin or CSRF protection');
    return true;
  }
}
