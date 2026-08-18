import { Injectable, NotFoundException } from '@nestjs/common';
import {
  StageCompletenessService,
} from '@mandarin/domain';
import {
  AssignmentSource,
  AssignmentStatus,
  OwnerRole,
  ParticipantRole,
  StageClosureContext,
  StageCompletenessInput,
  StageCompletenessResult,
  StageClosurePermissionResult,
  StageInstanceStatus,
} from '@mandarin/contracts';
import { getEnv, isStoma1cIntegrated } from '@mandarin/config';
import { PrismaService } from '../../common/services/prisma.service';
import { StageTemplateSyncService } from './stage-template-sync.service';

@Injectable()
export class StageCompletenessApiService {
  private readonly domainService = new StageCompletenessService();

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateSync: StageTemplateSyncService,
  ) {}

  async buildInput(stageInstanceId: string): Promise<StageCompletenessInput> {
    await this.templateSync.ensureRequirementInstancesForStage(stageInstanceId);
    await this.templateSync.ensureRadiologyStudiesFromMedia(stageInstanceId);

    const stage = await this.prisma.stageInstance.findUnique({
      where: { id: stageInstanceId },
      include: {
        stageTemplate: true,
        clinicalCase: {
          include: {
            participants: true,
          },
        },
        requirementInstances: {
          where: { mediaRequirement: { isActive: true } },
          include: {
            mediaRequirement: { include: { qualityProfile: true } },
          },
          orderBy: { mediaRequirement: { sortOrder: 'asc' } },
        },
        mediaAssets: {
          where: { archivedAt: null },
          include: {
            assignments: {
              include: { requirementInstance: { include: { mediaRequirement: true } } },
            },
          },
        },
        radiologyStudies: true,
        implants: { include: { radiologyAttachments: true } },
        surgeonConfirmation: true,
        doctorConfirmations: true,
        emergencyEvents: true,
      },
    });

    if (!stage) {
      throw new NotFoundException('Этап не найден');
    }

    const allStages = await this.prisma.stageInstance.findMany({
      where: { clinicalCaseId: stage.clinicalCaseId },
      include: { stageTemplate: true },
    });

    const implantMethods = await this.prisma.implantPlacementMethod.findMany({
      where: { isActive: true },
    });

    const externalRefs = await this.prisma.externalEntityReference.findMany({
      where: {
        internalEntityType: 'Patient',
        internalEntityId: stage.clinicalCase.patientId,
      },
    });

    const env = getEnv();
    const dependsOnCode = stage.stageTemplate.dependsOnStageCode;
    const dependencyStage = dependsOnCode
      ? allStages.find((s) => s.stageTemplate.code === dependsOnCode)
      : null;
    const dependencyStageClosed =
      !dependsOnCode || dependencyStage?.status === StageInstanceStatus.CLOSED;

    const methodsByCode = Object.fromEntries(
      implantMethods.map((m) => [
        m.code,
        {
          code: m.code,
          requiresNerveRelation: m.requiresNerveRelation,
          requiresSinusRelation: m.requiresSinusRelation,
          requiresNasalFloorRelation: m.requiresNasalFloorRelation,
          requiresPterygoidRelation: m.requiresPterygoidRelation,
          requiresZygomaticRelation: m.requiresZygomaticRelation,
          requiresCorticalTarget: m.requiresCorticalTarget,
        },
      ]),
    );

    const requirementCodeByInstanceId = new Map(
      stage.requirementInstances.map((ri) => [ri.id, ri.mediaRequirement.code]),
    );

    return {
      stageCode: stage.stageTemplate.code,
      stageStatus: stage.status,
      ownerRole: stage.stageTemplate.ownerRole as OwnerRole,
      participants: stage.clinicalCase.participants.map((p) => ({
        role: p.participantRole as ParticipantRole,
        isPrimary: p.isPrimary,
        removedAt: p.removedAt,
      })),
      requirements: stage.requirementInstances.map((ri) => ({
          id: ri.mediaRequirement.id,
          code: ri.mediaRequirement.code,
          name: ri.mediaRequirement.name,
          mediaType: ri.mediaRequirement.mediaType,
          required: ri.mediaRequirement.required,
          minCount: ri.mediaRequirement.minCount,
          maxCount: ri.mediaRequirement.maxCount,
          specialRule: ri.mediaRequirement.specialRule,
          qualityRequireAudio: ri.mediaRequirement.qualityProfile?.requireAudio ?? null,
        })),
      mediaAssets: stage.mediaAssets.map((asset) => ({
        id: asset.id,
        status: asset.status,
        mediaType: asset.mediaType,
        hasAudio: asset.hasAudio,
        assignments: asset.assignments.map((a) => ({
          requirementCode:
            a.requirementCode ??
            a.requirementInstance?.mediaRequirement?.code ??
            (a.requirementInstanceId
              ? requirementCodeByInstanceId.get(a.requirementInstanceId) ?? null
              : null),
          source: a.source as AssignmentSource,
          status: a.status as AssignmentStatus,
        })),
      })),
      radiologyStudies: stage.radiologyStudies.map((s) => ({
        studyType: s.studyType,
        status: s.status,
      })),
      implants: stage.implants.map((implant) => ({
        id: implant.id,
        implantLabel: implant.implantLabel,
        implantNumber: implant.implantNumber,
        jawScope: implant.jawScope,
        toothPositionFdi: implant.toothPositionFdi,
        implantTypeId: implant.implantTypeId,
        actualMethodCode: implant.actualMethodCode,
        status: implant.status,
        attachments: implant.radiologyAttachments.map((a) => ({
          attachmentType: a.attachmentType,
          surgeonConfirmed: a.surgeonConfirmed,
          showsNerveRelation: a.showsNerveRelation,
          showsSinusRelation: a.showsSinusRelation,
          showsNasalFloorRelation: a.showsNasalFloorRelation,
          showsPterygoidRelation: a.showsPterygoidRelation,
          showsZygomaticRelation: a.showsZygomaticRelation,
          showsCorticalEngagement: a.showsCorticalEngagement,
        })),
      })),
      methodsByCode,
      surgeonConfirmation: stage.surgeonConfirmation
        ? {
            allImplantsDocumented: stage.surgeonConfirmation.allImplantsDocumented,
            optgUploaded: stage.surgeonConfirmation.optgUploaded,
            cbctUploaded: stage.surgeonConfirmation.cbctUploaded,
            allImplantsHaveCtSlices: stage.surgeonConfirmation.allImplantsHaveCtSlices,
            allImplantsHaveMethodSelected: stage.surgeonConfirmation.allImplantsHaveMethodSelected,
            hasImplantsForReview: stage.surgeonConfirmation.hasImplantsForReview,
          }
        : null,
      doctorConfirmationPresent: stage.doctorConfirmations.length > 0,
      dependsOnStageCode: stage.stageTemplate.dependsOnStageCode,
      startBlockedUntilDependencyClosed: stage.stageTemplate.startBlockedUntilDependencyClosed,
      closeBlockedUntilDependencyClosed: stage.stageTemplate.closeBlockedUntilDependencyClosed,
      dependencyStageClosed,
      clinicalFields: {
        restHeightMm: stage.restHeightMm ? Number(stage.restHeightMm) : null,
        workingHeightMm: stage.workingHeightMm ? Number(stage.workingHeightMm) : null,
        registrationConclusion: stage.registrationConclusion,
        desiredToothShade: stage.desiredToothShade ?? null,
      },
      impressionCaptureMode: stage.impressionCaptureMode ?? null,
      mediaBranchMode: stage.mediaBranchMode ?? null,
      emergencyEventsCount: stage.emergencyEvents.length,
      misProvider: env.MIS_PROVIDER,
      stoma1cIntegrationEnabled: isStoma1cIntegrated(env),
      hasStoma1cLink: externalRefs.some((r) => r.system === 'STOMA1C'),
    };
  }

  async evaluate(stageInstanceId: string): Promise<StageCompletenessResult> {
    const input = await this.buildInput(stageInstanceId);
    return this.domainService.evaluate(input);
  }

  async canUserClose(
    stageInstanceId: string,
    closingUserId: string,
  ): Promise<{
    completeness: StageCompletenessResult;
    permission: StageClosurePermissionResult;
  }> {
    const input = await this.buildInput(stageInstanceId);
    const completeness = this.domainService.evaluate(input);

    const stage = await this.prisma.stageInstance.findUniqueOrThrow({
      where: { id: stageInstanceId },
      include: {
        stageTemplate: true,
        clinicalCase: { include: { participants: { where: { removedAt: null } } } },
        doctorConfirmations: true,
        surgeonConfirmation: true,
        emergencyEvents: true,
      },
    });

    const participantUsers = await this.prisma.user.findMany({
      where: {
        staffMemberId: {
          in: stage.clinicalCase.participants.map((p) => p.staffMemberId),
        },
      },
    });

    const closingUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: closingUserId },
    });

    const env = getEnv();

    const firstBatch = await this.prisma.uploadBatch.findFirst({
      where: { stageInstanceId },
      orderBy: { createdAt: 'asc' },
      select: { uploadedBy: true },
    });

    const context: StageClosureContext = {
      stageInstanceId,
      stageCode: stage.stageTemplate.code,
      stageTemplateOwnerRole: stage.stageTemplate.ownerRole as OwnerRole,
      stageStatus: stage.status,
      closingUserId,
      closingUserRole: closingUser.role,
      closingUserStaffMemberId: closingUser.staffMemberId,
      startedByUserId: stage.startedByUserId ?? firstBatch?.uploadedBy ?? null,
      primaryParticipants: stage.clinicalCase.participants.map((p) => ({
        role: p.participantRole as ParticipantRole,
        staffMemberId: p.staffMemberId,
        userId: participantUsers.find((u) => u.staffMemberId === p.staffMemberId)?.id ?? null,
        isPrimary: p.isPrimary,
      })),
      misProvider: env.MIS_PROVIDER,
      stoma1cIntegrationEnabled: isStoma1cIntegrated(env),
      hasExternalPatientLink: false,
      hasDoctorConfirmation: stage.doctorConfirmations.length > 0,
      hasSurgeonRadiologyConfirmation: stage.surgeonConfirmation !== null,
      hasEmergencyEvents: stage.emergencyEvents.length > 0,
    };

    const permission = this.domainService.canUserCloseStage(context, completeness);
    return { completeness, permission };
  }
}
