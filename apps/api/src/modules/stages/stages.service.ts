import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ORTHODONTIC_CONFIRMATION_TEXT,
  StageCode,
  StageInstanceStatus,
  StageOwnerRole,
  UserRole,
} from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { StageCompletenessApiService } from './stage-completeness-api.service';

@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completenessService: StageCompletenessApiService,
  ) {}

  async findOne(stageId: string) {
    const stage = await this.prisma.stageInstance.findUnique({
      where: { id: stageId },
      include: {
        stageTemplate: true,
        requirementInstances: {
          where: { mediaRequirement: { isActive: true } },
          include: { mediaRequirement: true },
          orderBy: { mediaRequirement: { sortOrder: 'asc' } },
        },
        mediaAssets: {
          include: {
            assignments: {
              include: {
                requirementInstance: { include: { mediaRequirement: true } },
              },
            },
          },
          where: { archivedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });
    if (!stage) throw new NotFoundException('Этап не найден');
    return {
      ...stage,
      mediaAssets: stage.mediaAssets.map((asset) => {
        const primary = asset.assignments.find((a) => a.status !== 'REJECTED') ?? asset.assignments[0];
        const mr = primary?.requirementInstance?.mediaRequirement;
        const positionName = mr?.name ?? primary?.requirementCode ?? null;
        return {
          ...asset,
          fileSizeBytes:
            typeof asset.fileSizeBytes === 'bigint'
              ? Number(asset.fileSizeBytes)
              : asset.fileSizeBytes,
          displayName: positionName ?? asset.originalFileName,
          positionName,
          requirementCode: primary?.requirementCode ?? mr?.code ?? null,
          sortOrder: mr?.sortOrder ?? null,
          mediaRequirementId: mr?.id ?? null,
        };
      }),
    };
  }

  async getCompleteness(stageId: string) {
    return this.completenessService.evaluate(stageId);
  }

  async confirm(stageId: string, user: AuthUser, confirmationText?: string) {
    const stage = await this.findOne(stageId);

    if (stage.stageTemplate.code === StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL) {
      throw new BadRequestException(
        'Для хирургического рентгенологического этапа используйте подтверждение хирурга через модуль имплантатов',
      );
    }

    this.assertRoleCanActOnStage(user.role, stage.stageTemplate.ownerRole as StageOwnerRole, 'confirm');

    const text = confirmationText ?? ORTHODONTIC_CONFIRMATION_TEXT;
    const snapshotHash = createHash('sha256').update(text + stageId).digest('hex');

    const confirmation = await this.prisma.doctorConfirmation.create({
      data: {
        stageInstanceId: stageId,
        doctorUserId: user.id,
        protocolVersionId: stage.protocolVersionId,
        confirmationText: text,
        snapshotHash,
      },
    });

    await this.prisma.stageInstance.update({
      where: { id: stageId },
      data: { status: StageInstanceStatus.CONFIRMED },
    });

    return confirmation;
  }

  async close(stageId: string, user: AuthUser, comment?: string) {
    const stage = await this.findOne(stageId);

    if (stage.status === StageInstanceStatus.CLOSED) {
      throw new BadRequestException('Этап уже закрыт');
    }

    this.assertRoleCanActOnStage(user.role, stage.stageTemplate.ownerRole as StageOwnerRole, 'close');

    const { completeness, permission } = await this.completenessService.canUserClose(stageId, user.id);

    if (!permission.canClose) {
      throw new BadRequestException({
        message: 'Этап нельзя закрыть',
        blockingReasons: permission.blockingReasons,
        completeness,
      });
    }

    const snapshotHash = createHash('sha256')
      .update(JSON.stringify(completeness))
      .digest('hex');

    const closure = await this.prisma.stageClosure.create({
      data: {
        stageInstanceId: stageId,
        closedByUserId: user.id,
        closureSnapshotHash: snapshotHash,
        comment: comment ?? null,
      },
    });

    await this.prisma.stageInstance.update({
      where: { id: stageId },
      data: { status: StageInstanceStatus.CLOSED, closedAt: new Date() },
    });

    return { closure, completeness };
  }

  async reopen(stageId: string, user: AuthUser, reason: string) {
    const stage = await this.findOne(stageId);

    if (stage.status !== StageInstanceStatus.CLOSED) {
      throw new BadRequestException('Этап не закрыт');
    }

    if (
      user.role !== UserRole.SYSTEM_ADMIN &&
      user.role !== UserRole.CHIEF_DOCTOR &&
      user.role !== UserRole.ORTHOPEDIC_MANAGER
    ) {
      throw new ForbiddenException('Недостаточно прав для переоткрытия этапа');
    }

    await this.prisma.stageInstance.update({
      where: { id: stageId },
      data: { status: StageInstanceStatus.REOPENED, closedAt: null },
    });

    return { stageInstanceId: stageId, reason, reopenedBy: user.id };
  }

  private assertRoleCanActOnStage(
    userRole: string,
    ownerRole: StageOwnerRole,
    action: 'close' | 'confirm',
  ) {
    if (userRole === UserRole.SYSTEM_ADMIN || userRole === UserRole.CHIEF_DOCTOR) {
      return;
    }

    if (ownerRole === StageOwnerRole.SURGEON && userRole === UserRole.ORTHOPEDIST) {
      throw new ForbiddenException(
        `Ортопед не может ${action === 'close' ? 'закрыть' : 'подтвердить'} хирургический этап`,
      );
    }

    if (ownerRole === StageOwnerRole.ORTHOPEDIST && userRole === UserRole.SURGEON) {
      throw new ForbiddenException(
        `Хирург не может ${action === 'close' ? 'закрыть' : 'подтвердить'} ортопедический этап`,
      );
    }
  }
}
