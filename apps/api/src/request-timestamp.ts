import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './modules/auth/auth.types.js';
import { receivedAt } from './modules/attendance/attendance-time.js';

export function captureRequestTimestamp(
  request: AuthRequest,
  _response: Response,
  next: NextFunction,
) {
  request.receivedAt = receivedAt(Date.now());
  next();
}

/** Install before init/listen so this runs before Nest's body parser waits for input. */
export function installRequestTimestamp(app: INestApplication) {
  app.use(captureRequestTimestamp);
}
