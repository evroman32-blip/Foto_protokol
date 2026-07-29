import { StageCode, StageOwnerRole, MediaType, ParticipantRole } from '@mandarin/contracts';
import type { StageCompletenessInput } from '@mandarin/contracts';

export function createBaseCompletenessInput(
  overrides: Partial<StageCompletenessInput> = {},
): StageCompletenessInput {
  return {
    stageCode: StageCode.PRE_OPERATION,
    stageStatus: 'DRAFT',
    ownerRole: StageOwnerRole.ORTHOPEDIST,
    currentUserIsPrimaryOwner: true,
    misProvider: 'none',
    stoma1cIntegrationEnabled: false,
    hasStoma1cLink: false,
    doctorConfirmationPresent: true,
    participants: [
      { role: ParticipantRole.CONSULTING_DOCTOR, isPrimary: true },
      { role: ParticipantRole.ORTHOPEDIST, isPrimary: true },
      { role: ParticipantRole.SURGEON, isPrimary: true },
      { role: ParticipantRole.DENTAL_TECHNICIAN, isPrimary: true },
    ],
    requirements: [
      {
        id: 'req-1',
        code: 'PREOP_FACE_FRONT_REST',
        name: 'Анфас в покое',
        mediaType: MediaType.PHOTO,
        required: true,
        minCount: 1,
      },
    ],
    mediaAssets: [],
    dependencyStageClosed: true,
    ...overrides,
  };
}

export function createJawRelationInput(dependencyClosed = false): StageCompletenessInput {
  return createBaseCompletenessInput({
    stageCode: StageCode.JAW_RELATION,
    dependsOnStageCode: StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL,
    startBlockedUntilDependencyClosed: true,
    closeBlockedUntilDependencyClosed: true,
    dependencyStageClosed: dependencyClosed,
    requirements: [],
    clinicalFields: {
      restHeightMm: 65,
      workingHeightMm: 58,
      registrationConclusion: 'ACCEPTABLE_FOR_LAB',
      desiredToothShade: 'A2',
    },
  });
}

export function createFirstPrototypeInput(): StageCompletenessInput {
  return createBaseCompletenessInput({
    stageCode: StageCode.FIRST_PROTOTYPE,
    requirements: [
      {
        id: 'v1',
        code: 'FP_VIDEO_SPEECH',
        name: 'Речь и фонетика',
        mediaType: MediaType.VIDEO,
        required: true,
        minCount: 1,
        qualityRequireAudio: true,
      },
      {
        id: 'v2',
        code: 'FP_VIDEO_FACE_DYNAMICS',
        name: 'Динамика лица',
        mediaType: MediaType.VIDEO,
        required: true,
        minCount: 1,
      },
    ],
  });
}
