import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { Roles } from '../../common/decorators/metadata.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Module } from '@nestjs/common';
import { USER_ROLE_LABELS } from '../auth/auth.service';

function actorName(actor: {
  email: string;
  role: string;
  staffMember?: { lastName: string; firstName: string; middleName: string | null } | null;
} | null) {
  if (!actor) return null;
  const fio = actor.staffMember
    ? [actor.staffMember.lastName, actor.staffMember.firstName, actor.staffMember.middleName]
        .filter(Boolean)
        .join(' ')
    : '';
  const role = USER_ROLE_LABELS[actor.role] ?? actor.role;
  return fio ? `${fio} (${role})` : `${actor.email} (${role})`;
}

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
          select: {
            id: true,
            email: true,
            role: true,
            staffMember: { select: { lastName: true, firstName: true, middleName: true } },
          },
        })
      : [];

    return events.map((event) => {
      const actor = actors.find((a) => a.id === event.actorUserId) ?? null;
      return {
        ...event,
        eventType: event.action,
        actor,
        actorEmail: actor?.email ?? null,
        actorName: actorName(actor),
        payload: event.metadata,
      };
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const event = await this.prisma.auditEvent.findUniqueOrThrow({ where: { id } });
    const actor = event.actorUserId
      ? await this.prisma.user.findUnique({
          where: { id: event.actorUserId },
          select: {
            id: true,
            email: true,
            role: true,
            staffMember: { select: { lastName: true, firstName: true, middleName: true } },
          },
        })
      : null;
    return {
      ...event,
      eventType: event.action,
      actor,
      actorName: actorName(actor),
      payload: event.metadata,
    };
  }
}

@Module({ controllers: [AuditController] })
export class AuditModule {}
