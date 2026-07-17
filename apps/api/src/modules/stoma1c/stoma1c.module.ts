import { Controller, Get, Param, Post, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { getEnv, isStoma1cIntegrated } from '@mandarin/config';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditAction, Public, SkipAudit } from '../../common/decorators/metadata.decorators';

function disabled() {
  return { enabled: false, status: 'disabled' as const };
}

@ApiTags('stoma1c')
@Controller('integrations/stoma1c')
export class Stoma1cController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipAudit()
  @Get('health')
  health() {
    const env = getEnv();
    if (!isStoma1cIntegrated(env)) return disabled();
    return {
      enabled: true,
      status: 'ok',
      provider: env.MIS_PROVIDER,
      baseUrl: env.STOMA1C_API_BASE_URL,
    };
  }

  @Post('patients/sync')
  @AuditAction('stoma1c.syncPatients')
  syncPatients() {
    if (!isStoma1cIntegrated()) return { ...disabled(), synced: 0 };
    return { enabled: true, status: 'ok', synced: 0, message: 'Синхронизация запланирована' };
  }

  @Post('staff/sync')
  @AuditAction('stoma1c.syncStaff')
  syncStaff() {
    if (!isStoma1cIntegrated()) return { ...disabled(), synced: 0 };
    return { enabled: true, status: 'ok', synced: 0 };
  }

  @Post('branches/sync')
  @AuditAction('stoma1c.syncBranches')
  syncBranches() {
    if (!isStoma1cIntegrated()) return { ...disabled(), synced: 0 };
    return { enabled: true, status: 'ok', synced: 0 };
  }

  @Post('cases/:caseId/push-status')
  @AuditAction('stoma1c.pushStatus')
  pushStatus(@Param('caseId') caseId: string) {
    if (!isStoma1cIntegrated()) return { ...disabled(), caseId };
    return { enabled: true, status: 'queued', caseId };
  }

  @Post('reports/:reportId/attach')
  @AuditAction('stoma1c.attachReport')
  attachReport(@Param('reportId') reportId: string) {
    if (!isStoma1cIntegrated()) return { ...disabled(), reportId };
    return { enabled: true, status: 'queued', reportId };
  }

  @Get('events')
  async events() {
    if (!isStoma1cIntegrated()) return { ...disabled(), events: [] };
    const events = await this.prisma.integrationEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return { enabled: true, events };
  }
}

@Module({ controllers: [Stoma1cController] })
export class Stoma1cModule {}
