import { describe, expect, it } from 'vitest';
import { StageCompletenessService } from '@mandarin/domain';
import {
  AssignmentSource,
  AssignmentStatus,
  MediaAssetStatus,
  MediaType,
  ParticipantRole,
  StageCode,
  StageInstanceStatus,
  StageOwnerRole,
} from '@mandarin/contracts';

describe('StageCompletenessService (API unit)', () => {
  const service = new StageCompletenessService();

  const baseInput = {
    stageInstanceId: 'stage-1',
    stageTemplate: {
      code: StageCode.JAW_RELATION,
      name: 'Межчелюстные соотношения',
      ownerRole: StageOwnerRole.ORTHOPEDIST,
      dependsOnStageCode: StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL,
      startBlockedUntilDependencyClosed: true,
      closeBlockedUntilDependencyClosed: true,
    },
    requirements: [],
    requirementInstances: [],
    assignments: [],
    mediaAssets: [],
    primaryParticipants: [
      { role: ParticipantRole.CONSULTING_DOCTOR, isPrimary: true },
      { role: ParticipantRole.ORTHOPEDIST, isPrimary: true },
      { role: ParticipantRole.SURGEON, isPrimary: true },
      { role: ParticipantRole.DENTAL_TECHNICIAN, isPrimary: true },
    ],
    radiologyStudies: [],
    implantRecords: [],
    implantAttachments: [],
    implantMethods: [],
    surgeonConfirmation: null,
    structuredClinicalFields: {
      restHeightMm: 10,
      workingHeightMm: 12,
      optgStatus: null,
      registrationConclusion: 'ACCEPTABLE_FOR_LAB',
    },
    dependencyStages: [
      {
        stageCode: StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL,
        stageName: 'Послеоперационный контроль',
        status: StageInstanceStatus.DRAFT,
      },
    ],
    misProvider: 'none' as const,
    stoma1cIntegrationEnabled: false,
    hasExternalPatientLink: false,
    hasDoctorConfirmation: true,
    hasEmergencyEvents: false,
  };

  it('блокирует JAW_RELATION пока POSTOP_SURGICAL_RADIOLOGY_CONTROL не CLOSED', () => {
    const result = service.evaluate(baseInput);
    expect(result.isComplete).toBe(false);
    expect(result.blockingReasons.some((r) => r.includes('межчелюстных'))).toBe(true);
  });

  it('разблокирует JAW_RELATION после закрытия зависимого этапа', () => {
    const result = service.evaluate({
      ...baseInput,
      dependencyStages: [
        {
          stageCode: StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL,
          stageName: 'Послеоперационный контроль',
          status: StageInstanceStatus.CLOSED,
        },
      ],
    });
    expect(result.dependencyBlockers).toHaveLength(0);
  });

  it('требует подтверждение AI-назначений', () => {
    const result = service.evaluate({
      ...baseInput,
      stageTemplate: {
        ...baseInput.stageTemplate,
        code: StageCode.FIRST_PROTOTYPE,
        dependsOnStageCode: null,
        closeBlockedUntilDependencyClosed: false,
        startBlockedUntilDependencyClosed: false,
      },
      dependencyStages: [],
      requirements: [
        {
          code: 'FP_PHOTO_FRONT',
          name: 'Фото анфас',
          mediaType: MediaType.PHOTO,
          required: true,
          minCount: 1,
          maxCount: 1,
          specialRule: null,
          isActive: true,
        },
      ],
      assignments: [
        {
          id: 'a1',
          mediaAssetId: 'm1',
          requirementInstanceId: null,
          requirementCode: 'FP_PHOTO_FRONT',
          source: AssignmentSource.AI,
          status: AssignmentStatus.SUGGESTED,
        },
      ],
      mediaAssets: [
        { id: 'm1', status: MediaAssetStatus.AI_SUGGESTED, mediaType: MediaType.PHOTO },
      ],
    });
    expect(result.unconfirmedAssignments).toHaveLength(1);
    expect(result.blockingReasons).toContain('AI-предложение не подтверждено врачом.');
  });
});
