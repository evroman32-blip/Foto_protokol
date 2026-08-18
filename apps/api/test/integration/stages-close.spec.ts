import { describe, expect, it } from 'vitest';
import {
  StageCompletenessService,
} from '@mandarin/domain';
import {
  StageCode,
  StageInstanceStatus,
  StageOwnerRole,
  UserRole,
  ParticipantRole,
} from '@mandarin/contracts';

describe('Stage close permissions', () => {
  const service = new StageCompletenessService();

  it('ортопед не может закрыть хирургический этап (ownerRole SURGEON)', () => {
    const completeness = service.evaluate({
      stageInstanceId: 's1',
      stageTemplate: {
        code: StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL,
        name: 'Контроль',
        ownerRole: StageOwnerRole.SURGEON,
        dependsOnStageCode: null,
        startBlockedUntilDependencyClosed: false,
        closeBlockedUntilDependencyClosed: false,
      },
      requirements: [],
      requirementInstances: [],
      assignments: [],
      mediaAssets: [],
      primaryParticipants: [
        { role: ParticipantRole.SURGEON, isPrimary: true },
        { role: ParticipantRole.ORTHOPEDIST, isPrimary: true },
      ],
      radiologyStudies: [],
      implantRecords: [],
      implantAttachments: [],
      implantMethods: [],
      surgeonConfirmation: null,
      structuredClinicalFields: null,
      dependencyStages: [],
      misProvider: 'none',
      stoma1cIntegrationEnabled: false,
      hasExternalPatientLink: false,
      hasDoctorConfirmation: false,
      hasEmergencyEvents: false,
    });

    const permission = service.canUserCloseStage(
      {
        stageInstanceId: 's1',
        stageCode: StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL,
        stageTemplateOwnerRole: StageOwnerRole.SURGEON,
        stageStatus: StageInstanceStatus.CONFIRMED,
        closingUserId: 'ortho-user',
        closingUserRole: UserRole.ORTHOPEDIST,
        closingUserStaffMemberId: 'staff-ortho',
        primaryParticipants: [
          {
            role: ParticipantRole.ORTHOPEDIST,
            staffMemberId: 'staff-ortho',
            userId: 'ortho-user',
            isPrimary: true,
          },
          {
            role: ParticipantRole.SURGEON,
            staffMemberId: 'staff-surgeon',
            userId: 'surgeon-user',
            isPrimary: true,
          },
        ],
        misProvider: 'none',
        stoma1cIntegrationEnabled: false,
        hasExternalPatientLink: false,
        hasDoctorConfirmation: false,
        hasSurgeonRadiologyConfirmation: false,
        hasEmergencyEvents: false,
      },
      completeness,
    );

    expect(permission.canClose).toBe(false);
    expect(permission.blockingReasons.some((r) => r.includes('начал этот этап'))).toBe(true);
  });

  it('главный врач может закрыть этап, даже если не начинал его', () => {
    const completeness = service.evaluate({
      stageCode: StageCode.PRE_OPERATION,
      stageStatus: StageInstanceStatus.CONFIRMED,
      ownerRole: StageOwnerRole.ORTHOPEDIST,
      participants: [
        { role: ParticipantRole.CONSULTING_DOCTOR, isPrimary: true },
        { role: ParticipantRole.ORTHOPEDIST, isPrimary: true },
        { role: ParticipantRole.SURGEON, isPrimary: true },
        { role: ParticipantRole.DENTAL_TECHNICIAN, isPrimary: true },
      ],
      requirements: [],
      mediaAssets: [],
      doctorConfirmationPresent: true,
    });
    const permission = service.canUserCloseStage(
      {
        stageInstanceId: 's1',
        stageCode: StageCode.PRE_OPERATION,
        stageTemplateOwnerRole: StageOwnerRole.ORTHOPEDIST,
        stageStatus: StageInstanceStatus.CONFIRMED,
        closingUserId: 'chief',
        closingUserRole: UserRole.CHIEF_DOCTOR,
        startedByUserId: 'surgeon-user',
        primaryParticipants: [],
        hasDoctorConfirmation: true,
        hasSurgeonRadiologyConfirmation: false,
      },
      completeness,
    );
    expect(permission.blockingReasons.some((r) => r.includes('начал этот этап'))).toBe(false);
  });

  it('врач, который начал этап, может закрыть его', () => {
    const completeness = service.evaluate({
      stageCode: StageCode.PRE_OPERATION,
      stageStatus: StageInstanceStatus.CONFIRMED,
      ownerRole: StageOwnerRole.ORTHOPEDIST,
      participants: [
        { role: ParticipantRole.CONSULTING_DOCTOR, isPrimary: true },
        { role: ParticipantRole.ORTHOPEDIST, isPrimary: true },
        { role: ParticipantRole.SURGEON, isPrimary: true },
        { role: ParticipantRole.DENTAL_TECHNICIAN, isPrimary: true },
      ],
      requirements: [],
      mediaAssets: [],
      doctorConfirmationPresent: true,
    });
    const permission = service.canUserCloseStage(
      {
        stageInstanceId: 's1',
        stageCode: StageCode.PRE_OPERATION,
        stageTemplateOwnerRole: StageOwnerRole.ORTHOPEDIST,
        stageStatus: StageInstanceStatus.CONFIRMED,
        closingUserId: 'surgeon-user',
        closingUserRole: UserRole.SURGEON,
        startedByUserId: 'surgeon-user',
        primaryParticipants: [],
        hasDoctorConfirmation: true,
        hasSurgeonRadiologyConfirmation: false,
      },
      completeness,
    );
    expect(permission.blockingReasons.some((r) => r.includes('начал этот этап'))).toBe(false);
  });
});
