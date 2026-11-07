import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthRequest } from '../auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) =>
    context.switchToHttp().getRequest<AuthRequest>().auth?.user,
);
