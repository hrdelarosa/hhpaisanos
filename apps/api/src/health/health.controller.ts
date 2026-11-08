import { Controller, Get } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator.js';

@Controller('api/health')
export class HealthController {
  @Get()
  @Public()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
