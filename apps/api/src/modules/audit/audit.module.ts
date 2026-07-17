import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { Roles } from '../../common/decorators/metadata.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Module } from '@nestjs/common';

@ApiTags('audit')
@Controller('audit')
@UseGuards(RolesGuard)
@Roles(UserRole.AUDITOR, UserRole.SYSTEM_ADMIN, UserRole.CHIEF_DOCTOR)
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @Query('clinicalCaseId') clinicalCaseId?: string,
    @Query('caseId') caseId?: string,
    @Query('stageInstanceId') stageInstanceId?: string,
    @Query('limit') limit?: string,
  ) {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        clinicalCaseId: clinicalCaseId ?? caseId ?? undefined,
        stageInstanceId: stageInstanceId ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 100,
    });

    const actorIds = [...new Set(events.map((e) => e.actorUserId).filter(Boolean))] as string[];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true, role: true },
        })
      : [];

    return events.map((event) => ({
      ...event,
      eventType: event.action,
      actor: actors.find((a) => a.id === event.actorUserId) ?? null,
      actorEmail: actors.find((a) => a.id === event.actorUserId)?.email ?? null,
      payload: event.metadata,
    }));
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const event = await this.prisma.auditEvent.findUniqueOrThrow({ where: { id } });
    const actor = event.actorUserId
      ? await this.prisma.user.findUnique({
          where: { id: event.actorUserId },
          select: { id: true, email: true, role: true },
        })
      : null;
    return { ...event, eventType: event.action, actor, payload: event.metadata };
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
