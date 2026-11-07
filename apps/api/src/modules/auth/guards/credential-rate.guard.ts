import { HttpException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class CredentialRateGuard implements CanActivate {
  private readonly windows = new Map<string, { until: number; count: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const now = Date.now();
    // Per-process IP backstop; persistent account protections are enforced in MySQL.
    if (this.windows.size >= 10000) {
      for (const [key, window] of this.windows) if (window.until <= now) this.windows.delete(key);
    }
    const key = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    let window = this.windows.get(key);
    if (!window || window.until <= now) {
      if (!window && this.windows.size >= 10000) throw new HttpException('Too many requests', 429);
      window = { until: now + 60000, count: 0 };
      this.windows.set(key, window);
    }
    if (++window.count > 30) {
      response.setHeader('Retry-After', Math.ceil((window.until - now) / 1000));
      throw new HttpException('Too many requests', 429);
    }
    return true;
  }
}
