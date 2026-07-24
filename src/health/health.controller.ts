import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  get(): { status: string; service: string } {
    return { status: 'ok', service: 'insurimple-ars-backend' };
  }
}
