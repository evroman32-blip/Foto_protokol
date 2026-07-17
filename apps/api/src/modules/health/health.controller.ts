import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public, SkipAudit } from '../../common/decorators/metadata.decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @SkipAudit()
  @Get()
  check() {
    return { status: 'ok', service: 'mandarin-api', timestamp: new Date().toISOString() };
  }
}
