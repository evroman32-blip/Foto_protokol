import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

export interface AuditPayload {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  clinicalCaseId?: string | null;
  stageInstanceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(payload: AuditPayload) {
    return this.prisma.auditEvent.create({
      data: {
        actorUserId: payload.actorUserId ?? null,
        action: payload.action,
        entityType: payload.entityType,
        entityId: payload.entityId,
        clinicalCaseId: payload.clinicalCaseId ?? null,
        stageInstanceId: payload.stageInstanceId ?? null,
        metadata: (payload.metadata ?? {}) as object,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent ?? null,
      },
    });
  }
}
