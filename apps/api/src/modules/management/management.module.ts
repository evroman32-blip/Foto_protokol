import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@mandarin/contracts';
import { getEnv, isStoma1cIntegrated } from '@mandarin/config';
import { PrismaService } from '../../common/services/prisma.service';
import { Roles } from '../../common/decorators/metadata.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Module } from '@nestjs/common';

@ApiTags('management')
@Controller('management')
@UseGuards(RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN, UserRole.CHIEF_DOCTOR, UserRole.ORTHOPEDIC_MANAGER, UserRole.AUDITOR)
export class ManagementController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('emergency-events')
  emergencyEvents() {
    return this.prisma.emergencyEvent.findMany({
      orderBy: { occurredAt: 'desc' },
      take: 100,
      include: { stageInstance: { include: { stageTemplate: true, clinicalCase: { include: { patient: true } } } } },
    });
  }

  @Get('integration-events')
  integrationEvents() {
    const env = getEnv();
    if (!isStoma1cIntegrated(env)) {
      return { enabled: false, status: 'disabled', events: [] };
    }
    return this.prisma.integrationEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('reports')
  reports() {
    return this.prisma.generatedReport.findMany({
      orderBy: { generatedAt: 'desc' },
      take: 100,
      include: { clinicalCase: { include: { patient: true } } },
    });
  }
}

@Module({ controllers: [ManagementController] })
export class ManagementModule {}
