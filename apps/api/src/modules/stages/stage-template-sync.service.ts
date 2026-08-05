import { Injectable } from '@nestjs/common';
import { CaseStatus } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';

const FROZEN_CASE_STATUSES: CaseStatus[] = [CaseStatus.COMPLETED, CaseStatus.ARCHIVED];

/**
 * Держит этапы/положения случая в синхроне с активным шаблоном протокола.
 * Источник истины: StageTemplate + MediaRequirement.isActive.
 */
@Injectable()
export class StageTemplateSyncService {
  constructor(private readonly prisma: PrismaService) {}

  private isFrozenCase(status: string) {
    return FROZEN_CASE_STATUSES.includes(status as CaseStatus);
  }

  /** Досеять RequirementInstance по всем активным положениям шаблона этапа. */
  async ensureRequirementInstancesForStage(stageInstanceId: string): Promise<void> {
    const stage = await this.prisma.stageInstance.findUnique({
      where: { id: stageInstanceId },
      select: {
        id: true,
        stageTemplateId: true,
        clinicalCase: { select: { status: true } },
      },
    });
    if (!stage) return;
    if (this.isFrozenCase(stage.clinicalCase.status)) return;

    const activeRequirements = await this.prisma.mediaRequirement.findMany({
      where: { stageTemplateId: stage.stageTemplateId, isActive: true },
      select: { id: true },
    });

    for (const req of activeRequirements) {
      await this.prisma.requirementInstance.upsert({
        where: {
          stageInstanceId_mediaRequirementId: {
            stageInstanceId: stage.id,
            mediaRequirementId: req.id,
          },
        },
        update: {},
        create: {
          stageInstanceId: stage.id,
          mediaRequirementId: req.id,
          status: 'PENDING',
        },
      });
    }
  }

  /**
   * Этапы случая = активные этапы шаблона протокола;
   * по каждому этапу — активные положения шаблона.
   */
  async ensureCaseAlignedWithTemplate(clinicalCaseId: string): Promise<void> {
    const clinicalCase = await this.prisma.clinicalCase.findUnique({
      where: { id: clinicalCaseId },
      select: {
        id: true,
        status: true,
        protocolVersionId: true,
        stages: { select: { id: true, stageTemplateId: true } },
      },
    });
    if (!clinicalCase) return;
    if (this.isFrozenCase(clinicalCase.status)) return;

    const templates = await this.prisma.stageTemplate.findMany({
      where: {
        protocolVersionId: clinicalCase.protocolVersionId,
        isActive: true,
      },
      include: {
        mediaRequirements: {
          where: { isActive: true },
          select: { id: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    const byTemplateId = new Map(
      clinicalCase.stages.map((s) => [s.stageTemplateId, s.id] as const),
    );

    for (const template of templates) {
      let stageId = byTemplateId.get(template.id);
      if (!stageId) {
        const created = await this.prisma.stageInstance.create({
          data: {
            clinicalCaseId: clinicalCase.id,
            stageTemplateId: template.id,
            protocolVersionId: clinicalCase.protocolVersionId,
            status: 'NOT_STARTED',
            requirementInstances: {
              create: template.mediaRequirements.map((req) => ({
                mediaRequirementId: req.id,
                status: 'PENDING',
              })),
            },
          },
          select: { id: true },
        });
        stageId = created.id;
        byTemplateId.set(template.id, stageId);
        continue;
      }

      for (const req of template.mediaRequirements) {
        await this.prisma.requirementInstance.upsert({
          where: {
            stageInstanceId_mediaRequirementId: {
              stageInstanceId: stageId,
              mediaRequirementId: req.id,
            },
          },
          update: {},
          create: {
            stageInstanceId: stageId,
            mediaRequirementId: req.id,
            status: 'PENDING',
          },
        });
      }
    }
  }

  /** Связать одно активное положение со всеми незакрытыми этапами шаблона. */
  async backfillRequirementAcrossOpenStages(
    stageTemplateId: string,
    mediaRequirementId: string,
  ): Promise<void> {
    const openStages = await this.prisma.stageInstance.findMany({
      where: {
        stageTemplateId,
        status: { not: 'CLOSED' },
        clinicalCase: { status: { notIn: FROZEN_CASE_STATUSES } },
      },
      select: { id: true },
    });
    for (const stage of openStages) {
      await this.prisma.requirementInstance.upsert({
        where: {
          stageInstanceId_mediaRequirementId: {
            stageInstanceId: stage.id,
            mediaRequirementId,
          },
        },
        update: {},
        create: {
          stageInstanceId: stage.id,
          mediaRequirementId,
          status: 'PENDING',
        },
      });
    }
  }

  /** Добавить StageInstance нового шаблона во все незакрытые случаи версии протокола. */
  async backfillStageTemplateAcrossOpenCases(stageTemplateId: string): Promise<void> {
    const template = await this.prisma.stageTemplate.findUnique({
      where: { id: stageTemplateId },
      select: { id: true, protocolVersionId: true, isActive: true },
    });
    if (!template?.isActive) return;

    const cases = await this.prisma.clinicalCase.findMany({
      where: {
        protocolVersionId: template.protocolVersionId,
        status: { notIn: FROZEN_CASE_STATUSES },
      },
      select: { id: true },
    });
    for (const clinicalCase of cases) {
      await this.ensureCaseAlignedWithTemplate(clinicalCase.id);
    }
  }

  /**
   * Уже загруженные ОПТГ/КТ по положениям шаблона регистрируем как RadiologyStudy,
   * чтобы экран рентгенологии и комплектность их видели.
   */
  async ensureRadiologyStudiesFromMedia(stageInstanceId: string): Promise<void> {
    const stage = await this.prisma.stageInstance.findUnique({
      where: { id: stageInstanceId },
      select: {
        id: true,
        clinicalCaseId: true,
        clinicalCase: { select: { status: true } },
        mediaAssets: {
          where: { archivedAt: null },
          include: {
            assignments: {
              where: { status: 'CONFIRMED' },
              include: { requirementInstance: { include: { mediaRequirement: true } } },
            },
          },
        },
      },
    });
    if (!stage || this.isFrozenCase(stage.clinicalCase.status)) return;

    for (const asset of stage.mediaAssets) {
      for (const asg of asset.assignments) {
        const code =
          asg.requirementCode ?? asg.requirementInstance?.mediaRequirement?.code ?? null;
        if (code !== 'POSTOP_OPTG') continue;
        const studyType = 'OPTG';
        const existing = await this.prisma.radiologyStudy.findFirst({
          where: { stageInstanceId: stage.id, studyType },
        });
        if (!existing) {
          await this.prisma.radiologyStudy.create({
            data: {
              clinicalCaseId: stage.clinicalCaseId,
              stageInstanceId: stage.id,
              studyType,
              mainMediaAssetId: asset.id,
              status: 'READY',
              uploadedBy: asset.uploadedBy,
            },
          });
        } else if (!existing.mainMediaAssetId) {
          await this.prisma.radiologyStudy.update({
            where: { id: existing.id },
            data: { mainMediaAssetId: asset.id, status: 'READY' },
          });
        }
      }
    }
  }
}
