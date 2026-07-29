import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  ImpressionCaptureMode,
  ORTHODONTIC_CONFIRMATION_TEXT,
  StageCode,
  StageInstanceStatus,
  StageOwnerRole,
  UserRole,
} from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { StageCompletenessApiService } from './stage-completeness-api.service';
import { StageTemplateSyncService } from './stage-template-sync.service';

@Injectable()
export class StagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completenessService: StageCompletenessApiService,
    private readonly templateSync: StageTemplateSyncService,
  ) {}

  async findOne(stageId: string) {
    await this.templateSync.ensureRequirementInstancesForStage(stageId);

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
            implantAttachments: {
              include: {
                surgicalImplantRecord: { select: { toothPositionFdi: true, implantLabel: true } },
              },
            },
          },
          where: { archivedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });
    if (!stage) throw new NotFoundException('Этап не найден');

    const fdiOrder = [
      '18', '17', '16', '15', '14', '13', '12', '11',
      '28', '27', '26', '25', '24', '23', '22', '21',
      '38', '37', '36', '35', '34', '33', '32', '31',
      '48', '47', '46', '45', '44', '43', '42', '41',
    ];
    const fdiRank = (tooth?: string | null) => {
      if (!tooth) return 999;
      const idx = fdiOrder.indexOf(tooth);
      return idx === -1 ? 999 : idx;
    };

    const enriched = stage.mediaAssets.map((asset) => {
      const primary =
        asset.assignments.find((a) => a.status !== 'REJECTED') ?? asset.assignments[0];
      const mr = primary?.requirementInstance?.mediaRequirement;
      const code = primary?.requirementCode ?? mr?.code ?? null;
      const tooth =
        asset.implantAttachments[0]?.surgicalImplantRecord?.toothPositionFdi ?? null;
      const isSliceCard = code === 'POSTOP_IMPLANT_SLICE_CARDS' || Boolean(tooth);
      const toothLabel = tooth
        ? `Зуб ${tooth}`
        : asset.implantAttachments[0]?.surgicalImplantRecord?.implantLabel ?? null;
      const positionName = isSliceCard
        ? toothLabel ?? mr?.name ?? 'Карточки срезов имплантатов'
        : (mr?.name ?? primary?.requirementCode ?? null);
      return {
        ...asset,
        // Тип из шаблона положения важнее эвристики по MIME при загрузке
        mediaType: (mr?.mediaType ?? asset.mediaType) as typeof asset.mediaType,
        fileSizeBytes:
          typeof asset.fileSizeBytes === 'bigint'
            ? Number(asset.fileSizeBytes)
            : asset.fileSizeBytes,
        displayName: positionName ?? asset.originalFileName,
        positionName,
        requirementCode: code,
        sortOrder: mr?.sortOrder ?? (isSliceCard ? 3 : null),
        mediaRequirementId: mr?.id ?? null,
        toothPositionFdi: tooth,
        _toothRank: fdiRank(tooth),
      };
    });

    enriched.sort((a, b) => {
      const so = (a.sortOrder ?? 999) - (b.sortOrder ?? 999);
      if (so !== 0) return so;
      return (a._toothRank ?? 999) - (b._toothRank ?? 999);
    });

    return {
      ...stage,
      mediaAssets: enriched.map(({ _toothRank, ...asset }) => asset),
    };
  }

  async getCompleteness(stageId: string) {
    return this.completenessService.evaluate(stageId);
  }

  async setImpressionCaptureMode(
    stageId: string,
    user: AuthUser,
    mode: ImpressionCaptureMode,
  ) {
    const stage = await this.prisma.stageInstance.findUnique({
      where: { id: stageId },
      include: { stageTemplate: true },
    });
    if (!stage) throw new NotFoundException('Этап не найден');
    if (stage.stageTemplate.code !== StageCode.IMPRESSIONS_OR_SCANS) {
      throw new BadRequestException(
        'Выбор скан/оттиск доступен только на этапе оттисков и сканов',
      );
    }
    if (stage.status === StageInstanceStatus.CLOSED) {
      throw new BadRequestException('Нельзя менять способ получения на закрытом этапе');
    }
    this.assertRoleCanActOnStage(
      user.role,
      stage.stageTemplate.ownerRole as StageOwnerRole,
      'confirm',
    );

    return this.prisma.stageInstance.update({
      where: { id: stageId },
      data: { impressionCaptureMode: mode },
      include: { stageTemplate: true },
    });
  }

  async setDesiredToothShade(stageId: string, user: AuthUser, desiredToothShade: string) {
    const stage = await this.prisma.stageInstance.findUnique({
      where: { id: stageId },
      include: { stageTemplate: true },
    });
    if (!stage) throw new NotFoundException('Этап не найден');
    if (stage.stageTemplate.code !== StageCode.JAW_RELATION) {
      throw new BadRequestException(
        'Выбор цвета зубов доступен только на этапе межчелюстных соотношений',
      );
    }
    if (stage.status === StageInstanceStatus.CLOSED) {
      throw new BadRequestException('Нельзя менять цвет зубов на закрытом этапе');
    }
    this.assertRoleCanActOnStage(
      user.role,
      stage.stageTemplate.ownerRole as StageOwnerRole,
      'confirm',
    );

    return this.prisma.stageInstance.update({
      where: { id: stageId },
      data: { desiredToothShade },
      include: { stageTemplate: true },
    });
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

    await this.templateSync.ensureRequirementInstancesForStage(stageId);

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
