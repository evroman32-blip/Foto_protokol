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

  it('does not require a separate doctor confirmation — closing the stage is the confirmation', () => {
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
    expect(r.isComplete).toBe(true);
    expect(r.blockingReasons).not.toContain('Отсутствует подтверждение врача.');
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
        radiologyStudies: [{ studyType: 'OPTG', status: 'READY' }],
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-01',
            implantNumber: 1,
            actualMethodCode: 'M2',
            status: 'DOCUMENTED',
            attachments: [],
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

  it('blocks surgical stage without any JPG slice in tooth forms', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        doctorConfirmationPresent: true,
        requirements: [],
        radiologyStudies: [{ studyType: 'OPTG', status: 'READY' }],
        implants: [],
        surgeonConfirmation: null,
      }),
    );
    expect(r.blockingReasons).toContain(
      'Не загружен ни один JPG-срез имплантата (пустые окна зубов допустимы).',
    );
  });

  it('ignores leftover implant registry without a slice and does not require tooth number', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        currentUserIsPrimaryOwner: true,
        requirements: [],
        radiologyStudies: [{ studyType: 'OPTG', status: 'READY' }],
        implants: [
          {
            id: 'ghost',
            implantLabel: 'IMP-01',
            implantNumber: 1,
            actualMethodCode: null,
            status: 'DOCUMENTED',
            attachments: [],
          },
          {
            id: 'slice-18',
            implantLabel: 'Зуб 18',
            implantNumber: 18,
            jawScope: 'UPPER',
            toothPositionFdi: '18',
            actualMethodCode: null,
            status: 'DOCUMENTED',
            attachments: [{ attachmentType: 'CT_CROSS_SECTION', surgeonConfirmed: true }],
          },
        ],
        surgeonConfirmation: null,
      }),
    );
    expect(r.blockingReasons.join(' ')).not.toMatch(/номер зуба|челюсть|хирург не подтвердил/i);
    expect(r.isComplete).toBe(true);
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
        radiologyStudies: [],
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-01',
            implantNumber: 1,
            actualMethodCode: 'M2',
            status: 'DOCUMENTED',
            attachments: [],
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

  it('does not block implant without method or type (optional at this stage)', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        requirements: [],
        radiologyStudies: [{ studyType: 'OPTG', status: 'READY' }],
        implants: [
          {
            id: 'i1',
            implantLabel: 'Зуб 16',
            implantNumber: 16,
            jawScope: 'UPPER',
            toothPositionFdi: '16',
            actualMethodCode: null,
            implantTypeId: null,
            status: 'DOCUMENTED',
            attachments: [{ attachmentType: 'CT_CROSS_SECTION', surgeonConfirmed: true }],
          },
        ],
        surgeonConfirmation: {
          allImplantsDocumented: true,
          optgUploaded: true,
          cbctUploaded: true,
          allImplantsHaveCtSlices: true,
          allImplantsHaveMethodSelected: false,
          hasImplantsForReview: false,
        },
      }),
    );
    expect(r.blockingReasons.join(' ')).not.toMatch(/метод|вид имплантата/i);
  });

  it('does not require CBCT or DICOM for surgical stage', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
        ownerRole: 'SURGEON',
        doctorConfirmationPresent: true,
        currentUserIsPrimaryOwner: true,
        requirements: [],
        radiologyStudies: [{ studyType: 'OPTG', status: 'READY' }],
        implants: [
          {
            id: 'i1',
            implantLabel: 'IMP-01',
            implantNumber: 1,
            jawScope: 'UPPER',
            toothPositionFdi: '16',
            implantTypeId: 'type-1',
            actualMethodCode: 'M2',
            status: 'DOCUMENTED',
            attachments: [{ attachmentType: 'CT_CROSS_SECTION', surgeonConfirmed: true }],
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
    expect(r.blockingReasons.some((b) => b.includes('КЛКТ') || b.includes('DICOM'))).toBe(false);
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

  const impressionsReqs = [
    {
      id: 's1',
      code: 'IMP_SCAN_UPPER',
      name: 'Скан ВЧ',
      mediaType: 'STL',
      required: true,
      minCount: 1,
    },
    {
      id: 's2',
      code: 'IMP_SCAN_LOWER',
      name: 'Скан НЧ',
      mediaType: 'STL',
      required: true,
      minCount: 1,
    },
    {
      id: 'p1',
      code: 'IMP_PHOTO_IMPRESSIONS_UPPER',
      name: 'Фото оттисков ВЧ',
      mediaType: 'PHOTO',
      required: true,
      minCount: 1,
    },
    {
      id: 'p2',
      code: 'IMP_PHOTO_IMPRESSIONS_LOWER',
      name: 'Фото оттисков НЧ',
      mediaType: 'PHOTO',
      required: true,
      minCount: 1,
    },
  ];

  it('IMPRESSIONS_OR_SCANS blocks until capture mode is chosen', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'IMPRESSIONS_OR_SCANS',
        impressionCaptureMode: null,
        requirements: impressionsReqs,
        mediaAssets: [],
      }),
    );
    expect(r.blockingReasons).toContain('Не выбран способ получения: скан или оттиск.');
    expect(r.missingRequirements).not.toContain('IMP_SCAN_UPPER');
  });

  it('SCAN mode requires scans only, not impression photos', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'IMPRESSIONS_OR_SCANS',
        impressionCaptureMode: 'SCAN',
        requirements: impressionsReqs,
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'STL',
            assignments: [
              { requirementCode: 'IMP_SCAN_UPPER', source: 'DOCTOR', status: 'CONFIRMED' },
            ],
          },
          {
            id: 'm2',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'STL',
            assignments: [
              { requirementCode: 'IMP_SCAN_LOWER', source: 'DOCTOR', status: 'CONFIRMED' },
            ],
          },
        ],
      }),
    );
    expect(r.missingRequirements).not.toContain('IMP_PHOTO_IMPRESSIONS_UPPER');
    expect(r.missingRequirements).not.toContain('IMP_PHOTO_IMPRESSIONS_LOWER');
    expect(r.blockingReasons.some((b) => b.includes('оттиск'))).toBe(false);
  });

  it('IMPRESSION mode requires photos only, not scans', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'IMPRESSIONS_OR_SCANS',
        impressionCaptureMode: 'IMPRESSION',
        requirements: impressionsReqs,
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'IMP_PHOTO_IMPRESSIONS_UPPER',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
          {
            id: 'm2',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'IMP_PHOTO_IMPRESSIONS_LOWER',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
      }),
    );
    expect(r.missingRequirements).not.toContain('IMP_SCAN_UPPER');
    expect(r.missingRequirements).not.toContain('IMP_SCAN_LOWER');
    expect(r.blockingReasons.some((b) => b.includes('Скан'))).toBe(false);
  });

  it('blocks mixed-type stage until a media branch is chosen', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'NEW_STAGE_1',
        requirements: [
          {
            id: 'p',
            code: 'NOVOE_POLOZHENIE_1',
            name: 'Фото',
            mediaType: 'PHOTO',
            required: true,
            minCount: 1,
          },
          {
            id: 's',
            code: 'NOVOE_POLOZHENIE_3',
            name: 'Скан',
            mediaType: 'STL',
            required: true,
            minCount: 1,
          },
        ],
        mediaAssets: [],
        mediaBranchMode: null,
      }),
    );
    expect(r.blockingReasons).toContain('Не выбран вид информации для закрытия этапа.');
    expect(r.blockingReasons.join(' ')).not.toMatch(/NOVOE_POLOZHENIE/);
  });

  it('requires only the selected media branch on a mixed-type stage', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'NEW_STAGE_1',
        currentUserIsPrimaryOwner: true,
        requirements: [
          {
            id: 'p',
            code: 'NOVOE_POLOZHENIE_1',
            name: 'Фото',
            mediaType: 'PHOTO',
            required: true,
            minCount: 1,
          },
          {
            id: 's',
            code: 'NOVOE_POLOZHENIE_3',
            name: 'Скан',
            mediaType: 'STL',
            required: true,
            minCount: 1,
          },
        ],
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'NOVOE_POLOZHENIE_1',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
        mediaBranchMode: 'PHOTO',
      }),
    );
    expect(r.isComplete).toBe(true);
    expect(r.missingRequirements).not.toContain('NOVOE_POLOZHENIE_3');
  });

  it('requires every media type when ALL is selected', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'NEW_STAGE_1',
        requirements: [
          {
            id: 'p',
            code: 'NOVOE_POLOZHENIE_1',
            name: 'Фото',
            mediaType: 'PHOTO',
            required: true,
            minCount: 1,
          },
          {
            id: 's',
            code: 'NOVOE_POLOZHENIE_3',
            name: 'Скан',
            mediaType: 'STL',
            required: true,
            minCount: 1,
          },
        ],
        mediaAssets: [
          {
            id: 'm1',
            status: 'DOCTOR_CONFIRMED',
            mediaType: 'PHOTO',
            assignments: [
              {
                requirementCode: 'NOVOE_POLOZHENIE_1',
                source: 'DOCTOR',
                status: 'CONFIRMED',
              },
            ],
          },
        ],
        mediaBranchMode: 'ALL',
      }),
    );
    expect(r.isComplete).toBe(false);
    expect(r.missingRequirements).toContain('NOVOE_POLOZHENIE_3');
  });

  it('requires implant slice cards on a custom stage with that protocol position', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'NEW_STAGE_2',
        currentUserIsPrimaryOwner: true,
        requirements: [
          {
            id: 's',
            code: 'KARTOCHKI_SREZOV_IMPLANTATOV_JPG',
            name: 'Карточки срезов имплантатов (JPG)',
            mediaType: 'PHOTO',
            required: true,
            minCount: 1,
          },
        ],
        mediaAssets: [],
        implants: [],
      }),
    );
    expect(r.blockingReasons).toContain(
      'Не загружен ни один JPG-срез имплантата (пустые окна зубов допустимы).',
    );
    expect(r.blockingReasons.join(' ')).not.toMatch(/KARTOCHKI_SREZOV/);
  });

  it('closes a custom slice-card stage when at least one tooth window has a JPG', () => {
    const r = svc.evaluate(
      baseInput({
        stageCode: 'NEW_STAGE_2',
        currentUserIsPrimaryOwner: true,
        requirements: [
          {
            id: 's',
            code: 'KARTOCHKI_SREZOV_IMPLANTATOV_JPG',
            name: 'Карточки срезов имплантатов (JPG)',
            mediaType: 'PHOTO',
            required: true,
            minCount: 1,
          },
        ],
        mediaAssets: [],
        implants: [
          {
            id: 'i1',
            implantLabel: '16',
            implantNumber: 1,
            actualMethodCode: null,
            status: 'DOCUMENTED',
            attachments: [{ attachmentType: 'CT_CROSS_SECTION', surgeonConfirmed: true }],
          },
        ],
      }),
    );
    expect(r.isComplete).toBe(true);
  });
});
