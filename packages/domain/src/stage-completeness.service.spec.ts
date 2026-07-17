import { describe, it, expect } from 'vitest';
import { StageCompletenessService } from './stage-completeness.service';
import type { StageCompletenessInput } from '@mandarin/contracts';

const baseParticipants = [
  { role: 'CONSULTING_DOCTOR' as const, isPrimary: true },
  { role: 'ORTHOPEDIST' as const, isPrimary: true },
  { role: 'SURGEON' as const, isPrimary: true },
  { role: 'DENTAL_TECHNICIAN' as const, isPrimary: true },
];

function baseInput(over: Partial<StageCompletenessInput> = {}): StageCompletenessInput {
  return {
    stageCode: 'PRE_OPERATION',
    stageStatus: 'DRAFT',
    ownerRole: 'ORTHOPEDIST',
    currentUserIsPrimaryOwner: true,
    misProvider: 'none',
    stoma1cIntegrationEnabled: false,
    hasStoma1cLink: false,
    participants: baseParticipants,
    requirements: [
      {
        id: '1',
        code: 'PREOP_FACE_FRONT_REST',
        name: 'Анфас покой',
        mediaType: 'PHOTO',
        required: true,
        minCount: 1,
      },
    ],
    mediaAssets: [],
    dependencyStageClosed: true,
    doctorConfirmationPresent: true,
    ...over,
  };
}

describe('StageCompletenessService', () => {
  const svc = new StageCompletenessService();

  it('blocks when doctor confirmation missing on orthopedic stage', () => {
    const r = svc.evaluate(
      baseInput({
        doctorConfirmationPresent: false,
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'PREOP_FACE_FRONT_REST',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.blockingReasons).toContain('Отсутствует подтверждение врача.');
  });

  it('blocks when required photo missing', () => {
    const r = svc.evaluate(baseInput());
    expect(r.isComplete).toBe(false);
    expect(r.blockingReasons.some((b) => b.includes('PREOP_FACE_FRONT_REST'))).toBe(true);
  });

  it('passes when required photo confirmed by doctor', () => {
    const r = svc.evaluate(
      baseInput({
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'PREOP_FACE_FRONT_REST',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.isComplete).toBe(true);
  });

  it('does not count AI suggestion until doctor confirmation', () => {
    const r = svc.evaluate(
      baseInput({
        mediaAssets: [
          {
            id: 'm1',
            status: 'AI_SUGGESTED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'PREOP_FACE_FRONT_REST',
                source: 'AI',
                status: 'SUGGESTED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.isComplete).toBe(false);
    expect(r.blockingReasons).toContain('AI-предложение не подтверждено врачом.');
  });

  it('ignores additional media for completeness', () => {
    const r = svc.evaluate(
      baseInput({
        requirements: [
          {
            id: '1',
            code: 'PREOP_FACE_FRONT_REST',
            name: 'Анфас',
            mediaType: 'PHOTO',
            required: true,
            minCount: 1,
          },
          {
            id: '2',
            code: 'PREOP_ADDITIONAL_MEDIA',
            name: 'Доп',
            mediaType: 'PHOTO',
            required: false,
            minCount: 0,
          },
        ],
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'PREOP_FACE_FRONT_REST',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
          {
            id: 'm2',
            status: 'ADDITIONAL',
            mediaType: 'PHOTO',
            assignments: [],
          },
        ],
      }),
    );
    expect(r.isComplete).toBe(true);
  });

  it('does not count replaced media', () => {
    const r = svc.evaluate(
      baseInput({
        mediaAssets: [
          {
            id: 'm1',
            status: 'REPLACED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'PREOP_FACE_FRONT_REST',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.isComplete).toBe(false);
  });

  it('blocks missing participants', () => {
    const r = svc.evaluate(
      baseInput({
        participants: [
          { role: 'ORTHOPEDIST', isPrimary: true },
          { role: 'SURGEON', isPrimary: true },
        ],
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'PREOP_FACE_FRONT_REST',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.missingParticipants.length).toBeGreaterThan(0);
    expect(r.isComplete).toBe(false);
  });

  it('blocks non-owner primary from closing', () => {
    const r = svc.evaluate(
      baseInput({
        currentUserIsPrimaryOwner: false,
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'PREOP_FACE_FRONT_REST',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.blockingReasons.some((b) => b.includes('primary ORTHOPEDIST'))).toBe(true);
  });

  it('primary orthopedist cannot close surgical radiology stage', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        currentUserIsPrimaryOwner: false,
        doctorConfirmationPresent: true,
        requirements: [],
        radiologyStudies: [
          { studyType: 'OPTG', status: 'READY' },
          { studyType: 'CBCT', status: 'READY' },
        ],
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-01',
            implantNumber: 1,
            actualMethodCode: 'M2_CHIN_AREA_PLACEMENT',
            status: 'DOCUMENTED',
            attachments: [
              { attachmentType: 'CT_CROSS_SECTION', surgeonConfirmed: true },
            ],
          },
        ],
        surgeonConfirmation: {
          allImplantsDocumented: true,
          optgUploaded: true,
          cbctUploaded: true,
          allImplantsHaveCtSlices: true,
          allImplantsHaveMethodSelected: true,
          hasImplantsForReview: false,
        },
      }),
    );
    expect(r.blockingReasons.some((b) => b.includes('primary SURGEON'))).toBe(true);
  });

  it('primary surgeon cannot close orthopedic stage unless owner is surgeon', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'PRE_OPERATION',
        ownerRole: 'ORTHOPEDIST',
        currentUserIsPrimaryOwner: false,
        doctorConfirmationPresent: true,
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'PREOP_FACE_FRONT_REST',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.blockingReasons.some((b) => b.includes('primary ORTHOPEDIST'))).toBe(true);
  });

  it('blocks surgical stage without implant registry', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        doctorConfirmationPresent: true,
        requirements: [],
        radiologyStudies: [
          { studyType: 'OPTG', status: 'READY' },
          { studyType: 'CBCT', status: 'READY' },
        ],
        implants: [],
        surgeonConfirmation: null,
      }),
    );
    expect(r.blockingReasons).toContain('Не создан реестр установленных имплантатов.');
  });

  it('blocks FIRST_PROTOTYPE without speech video', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'FIRST_PROTOTYPE',
        requirements: [
          {
            id: 'v1',
            code: 'FP_VIDEO_SPEECH',
            name: 'Речь',
            mediaType: 'VIDEO',
            required: true,
            minCount: 1,
            qualityRequireAudio: true,
          },
          {
            id: 'v2',
            code: 'FP_VIDEO_FACE_DYNAMICS',
            name: 'Динамика',
            mediaType: 'VIDEO',
            required: true,
            minCount: 1,
          },
        ],
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'VIDEO',
            hasAudio: true,
            assignments: [
              {
                requirementCode: 'FP_VIDEO_FACE_DYNAMICS',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.blockingReasons).toContain(
      'Отсутствует обязательное видео речи и фонетики.',
    );
  });

  it('blocks FIRST_PROTOTYPE without face dynamics video', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'FIRST_PROTOTYPE',
        requirements: [
          {
            id: 'v1',
            code: 'FP_VIDEO_SPEECH',
            name: 'Речь',
            mediaType: 'VIDEO',
            required: true,
            minCount: 1,
          },
          {
            id: 'v2',
            code: 'FP_VIDEO_FACE_DYNAMICS',
            name: 'Динамика',
            mediaType: 'VIDEO',
            required: true,
            minCount: 1,
          },
        ],
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'VIDEO',
            hasAudio: true,
            assignments: [
              {
                requirementCode: 'FP_VIDEO_SPEECH',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.blockingReasons).toContain(
      'Отсутствует обязательное видео динамики лица, губ и улыбки.',
    );
  });

  it('blocks surgical stage without OPTG', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        requirements: [],
        radiologyStudies: [{ studyType: 'CBCT', status: 'READY' }],
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-01',
            implantNumber: 1,
            actualMethodCode: 'M2_CHIN_AREA_PLACEMENT',
            status: 'DOCUMENTED',
            attachments: [
              {
                attachmentType: 'CT_CROSS_SECTION',
                surgeonConfirmed: true,
              },
            ],
          },
        ],
        surgeonConfirmation: {
          allImplantsDocumented: true,
          optgUploaded: true,
          cbctUploaded: true,
          allImplantsHaveCtSlices: true,
          allImplantsHaveMethodSelected: true,
          hasImplantsForReview: false,
        },
      }),
    );
    expect(r.blockingReasons).toContain('Отсутствует послеоперационное ОПТГ.');
  });

  it('blocks surgical stage without CBCT', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        requirements: [],
        radiologyStudies: [{ studyType: 'OPTG', status: 'READY' }],
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-01',
            implantNumber: 1,
            actualMethodCode: 'M2_CHIN_AREA_PLACEMENT',
            status: 'DOCUMENTED',
            attachments: [
              { attachmentType: 'CT_CROSS_SECTION', surgeonConfirmed: true },
            ],
          },
        ],
        surgeonConfirmation: {
          allImplantsDocumented: true,
          optgUploaded: true,
          cbctUploaded: true,
          allImplantsHaveCtSlices: true,
          allImplantsHaveMethodSelected: true,
          hasImplantsForReview: false,
        },
      }),
    );
    expect(r.blockingReasons).toContain('Отсутствует послеоперационная КТ / КЛКТ.');
  });

  it('blocks implant without method', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        requirements: [],
        radiologyStudies: [
          { studyType: 'OPTG', status: 'READY' },
          { studyType: 'CBCT', status: 'READY' },
        ],
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-03',
            implantNumber: 3,
            actualMethodCode: null,
            status: 'DRAFT',
            attachments: [
              { attachmentType: 'CT_CROSS_SECTION', surgeonConfirmed: true },
            ],
          },
        ],
        surgeonConfirmation: null,
      }),
    );
    expect(r.blockingReasons).toContain(
      'Имплантат IMP-03 не привязан к методу установки.',
    );
  });

  it('blocks implant without confirmed CT slice with exact message', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        requirements: [],
        radiologyStudies: [
          { studyType: 'OPTG', status: 'READY' },
          { studyType: 'CBCT', status: 'READY' },
        ],
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-03',
            implantNumber: 3,
            actualMethodCode: 'M4_NERVE_BYPASS',
            status: 'DOCUMENTED',
            attachments: [],
          },
        ],
        surgeonConfirmation: null,
      }),
    );
    expect(r.blockingReasons).toContain(
      'Имплантат IMP-03 не имеет подтверждённого КТ-среза.',
    );
  });

  it('requires nerve evidence flag for nerve methods', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        doctorConfirmationPresent: true,
        requirements: [],
        radiologyStudies: [
          { studyType: 'OPTG', status: 'READY' },
          { studyType: 'CBCT', status: 'READY' },
        ],
        methodsByCode: {
          M4_NERVE_BYPASS: {
            code: 'M4_NERVE_BYPASS',
            requiresNerveRelation: true,
            requiresSinusRelation: false,
            requiresNasalFloorRelation: false,
            requiresPterygoidRelation: false,
            requiresZygomaticRelation: false,
            requiresCorticalTarget: false,
          },
        },
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-01',
            implantNumber: 1,
            actualMethodCode: 'M4_NERVE_BYPASS',
            status: 'DOCUMENTED',
            attachments: [
              {
                attachmentType: 'CT_CROSS_SECTION',
                surgeonConfirmed: true,
                showsNerveRelation: false,
              },
            ],
          },
        ],
        surgeonConfirmation: {
          allImplantsDocumented: true,
          optgUploaded: true,
          cbctUploaded: true,
          allImplantsHaveCtSlices: true,
          allImplantsHaveMethodSelected: true,
          hasImplantsForReview: false,
        },
      }),
    );
    expect(r.blockingReasons).toContain(
      'Имплантат IMP-01: требуется подтверждение отображения нижнего альвеолярного нерва на КТ-срезе.',
    );
  });

  it('requires sinus evidence flag for sinus methods', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        doctorConfirmationPresent: true,
        requirements: [],
        radiologyStudies: [
          { studyType: 'OPTG', status: 'READY' },
          { studyType: 'CBCT', status: 'READY' },
        ],
        methodsByCode: {
          M8A_MAXILLARY_SINUS_FLOOR_CORTICAL_ENGAGEMENT: {
            code: 'M8A_MAXILLARY_SINUS_FLOOR_CORTICAL_ENGAGEMENT',
            requiresNerveRelation: false,
            requiresSinusRelation: true,
            requiresNasalFloorRelation: false,
            requiresPterygoidRelation: false,
            requiresZygomaticRelation: false,
            requiresCorticalTarget: true,
          },
        },
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-02',
            implantNumber: 2,
            actualMethodCode: 'M8A_MAXILLARY_SINUS_FLOOR_CORTICAL_ENGAGEMENT',
            status: 'DOCUMENTED',
            attachments: [
              {
                attachmentType: 'CT_CROSS_SECTION',
                surgeonConfirmed: true,
                showsSinusRelation: false,
              },
            ],
          },
        ],
        surgeonConfirmation: {
          allImplantsDocumented: true,
          optgUploaded: true,
          cbctUploaded: true,
          allImplantsHaveCtSlices: true,
          allImplantsHaveMethodSelected: true,
          hasImplantsForReview: false,
        },
      }),
    );
    expect(r.blockingReasons).toContain(
      'Имплантат IMP-02: требуется подтверждение отображения верхнечелюстной пазухи на КТ-срезе.',
    );
  });

  it('requires nasal floor evidence flag for nasal floor methods', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        doctorConfirmationPresent: true,
        requirements: [],
        radiologyStudies: [
          { studyType: 'OPTG', status: 'READY' },
          { studyType: 'CBCT', status: 'READY' },
        ],
        methodsByCode: {
          M7A_NASAL_FLOOR_CORTICAL_ENGAGEMENT: {
            code: 'M7A_NASAL_FLOOR_CORTICAL_ENGAGEMENT',
            requiresNerveRelation: false,
            requiresSinusRelation: false,
            requiresNasalFloorRelation: true,
            requiresPterygoidRelation: false,
            requiresZygomaticRelation: false,
            requiresCorticalTarget: true,
          },
        },
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-04',
            implantNumber: 4,
            actualMethodCode: 'M7A_NASAL_FLOOR_CORTICAL_ENGAGEMENT',
            status: 'DOCUMENTED',
            attachments: [
              {
                attachmentType: 'CT_CROSS_SECTION',
                surgeonConfirmed: true,
                showsNasalFloorRelation: false,
              },
            ],
          },
        ],
        surgeonConfirmation: {
          allImplantsDocumented: true,
          optgUploaded: true,
          cbctUploaded: true,
          allImplantsHaveCtSlices: true,
          allImplantsHaveMethodSelected: true,
          hasImplantsForReview: false,
        },
      }),
    );
    expect(r.blockingReasons).toContain(
      'Имплантат IMP-04: требуется подтверждение отображения дна полости носа на КТ-срезе.',
    );
  });

  it('requires pterygoid evidence flag for pterygoid methods', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        doctorConfirmationPresent: true,
        requirements: [],
        radiologyStudies: [
          { studyType: 'OPTG', status: 'READY' },
          { studyType: 'CBCT', status: 'READY' },
        ],
        methodsByCode: {
          M10_TUBERO_PTERYGOID: {
            code: 'M10_TUBERO_PTERYGOID',
            requiresNerveRelation: false,
            requiresSinusRelation: false,
            requiresNasalFloorRelation: false,
            requiresPterygoidRelation: true,
            requiresZygomaticRelation: false,
            requiresCorticalTarget: true,
          },
        },
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-05',
            implantNumber: 5,
            actualMethodCode: 'M10_TUBERO_PTERYGOID',
            status: 'DOCUMENTED',
            attachments: [
              {
                attachmentType: 'CT_CROSS_SECTION',
                surgeonConfirmed: true,
                showsPterygoidRelation: false,
              },
            ],
          },
        ],
        surgeonConfirmation: {
          allImplantsDocumented: true,
          optgUploaded: true,
          cbctUploaded: true,
          allImplantsHaveCtSlices: true,
          allImplantsHaveMethodSelected: true,
          hasImplantsForReview: false,
        },
      }),
    );
    expect(r.blockingReasons).toContain(
      'Имплантат IMP-05: требуется подтверждение отображения бугорно-крыловидной зоны на КТ-срезе.',
    );
  });

  it('requires zygomatic evidence flag for zygomatic methods', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        doctorConfirmationPresent: true,
        requirements: [],
        radiologyStudies: [
          { studyType: 'OPTG', status: 'READY' },
          { studyType: 'CBCT', status: 'READY' },
        ],
        methodsByCode: {
          M12_ZYGOMATIC_IMPLANT: {
            code: 'M12_ZYGOMATIC_IMPLANT',
            requiresNerveRelation: false,
            requiresSinusRelation: false,
            requiresNasalFloorRelation: false,
            requiresPterygoidRelation: false,
            requiresZygomaticRelation: true,
            requiresCorticalTarget: true,
          },
        },
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-06',
            implantNumber: 6,
            actualMethodCode: 'M12_ZYGOMATIC_IMPLANT',
            status: 'DOCUMENTED',
            attachments: [
              {
                attachmentType: 'CT_CROSS_SECTION',
                surgeonConfirmed: true,
                showsZygomaticRelation: false,
              },
            ],
          },
        ],
        surgeonConfirmation: {
          allImplantsDocumented: true,
          optgUploaded: true,
          cbctUploaded: true,
          allImplantsHaveCtSlices: true,
          allImplantsHaveMethodSelected: true,
          hasImplantsForReview: false,
        },
      }),
    );
    expect(r.blockingReasons).toContain(
      'Имплантат IMP-06: требуется подтверждение отображения скуловой зоны на КТ-срезе.',
    );
  });

  it('blocks JAW_RELATION until surgical closed', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'JAW_RELATION',
        dependsOnStageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        startBlockedUntilDependencyClosed: true,
        closeBlockedUntilDependencyClosed: true,
        dependencyStageClosed: false,
        requirements: [],
      }),
    );
    expect(r.blockingReasons).toContain(
      'Этап межчелюстных соотношений заблокирован: не закрыт послеоперационный хирургический и рентгенологический контроль.',
    );
  });

  it('does not treat missing 1C as blocker in standalone', () => {
    const r = svc.evaluate(
      baseInput({
        misProvider: 'none',
        stoma1cIntegrationEnabled: false,
        hasStoma1cLink: false,
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'PREOP_FACE_FRONT_REST',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.isComplete).toBe(true);
    expect(r.warnings.some((w) => w.includes('1С'))).toBe(true);
  });

  it('emergency events do not clear blockers', () => {
    const r = svc.evaluate(
      baseInput({
        emergencyEventsCount: 1,
      }),
    );
    expect(r.isComplete).toBe(false);
    expect(r.warnings.some((w) => w.includes('неотложн'))).toBe(true);
  });
});
