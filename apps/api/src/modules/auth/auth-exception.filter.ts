import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AuthExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptions');
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');
    if (error instanceof HttpException) {
      // JSON parser errors can quote fragments of credential-bearing request bodies.
      if (error.getStatus() === 400) {
        response.status(400).json({ statusCode: 400, message: 'Invalid request input' });
        return;
      }
      const body = error.getResponse();
      response
        .status(error.getStatus())
        .json(typeof body === 'string' ? { message: body, statusCode: error.getStatus() } : body);
      return;
    }
    // Drizzle errors can embed SQL parameters, including password and token hashes.
    this.logger.error('Unhandled API error; exception details omitted to protect credentials');
    response.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}
