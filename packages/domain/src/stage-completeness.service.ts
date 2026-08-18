import {
  CompletenessResult,
  OwnerRole,
  StageClosureContext,
  StageClosurePermissionResult,
  StageCompletenessInput,
  UserRole,
  ParticipantRole,
  canCloseStage,
  hasMixedMediaBranches,
  MEDIA_BRANCH_ALL,
  isImplantSliceCardsRequirement,
} from '@mandarin/contracts';

const REQUIRED_PARTICIPANTS: ParticipantRole[] = [
  ParticipantRole.CONSULTING_DOCTOR,
  ParticipantRole.ORTHOPEDIST,
  ParticipantRole.SURGEON,
  ParticipantRole.DENTAL_TECHNICIAN,
];

const NON_COUNTABLE_STATUSES = new Set([
  'TECHNICALLY_REJECTED',
  'REPLACED',
  'ARCHIVED',
  'ADDITIONAL',
]);

const IMP_SCAN_CODES = new Set(['IMP_SCAN_UPPER', 'IMP_SCAN_LOWER']);
const IMP_PHOTO_CODES = new Set([
  'IMP_PHOTO_IMPRESSIONS_UPPER',
  'IMP_PHOTO_IMPRESSIONS_LOWER',
  'IMP_PHOTO_IMPRESSIONS',
]);

/**
 * Учитывает переключатель скан/оттиск и выбор вида медиа на смешанном этапе.
 * Шаблонные required=true сохраняются; runtime-режим снимает блокировку с неактивной ветки.
 */
export function isMediaRequirementEffectivelyRequired(opts: {
  stageCode: string;
  impressionCaptureMode?: 'SCAN' | 'IMPRESSION' | null;
  mediaBranchMode?: string | null;
  mixedMediaBranches?: boolean;
  code: string;
  mediaType?: string;
  templateRequired: boolean;
}): boolean {
  if (!opts.templateRequired) return false;
  if (opts.code === 'ADDITIONAL_MEDIA' || opts.code.endsWith('_ADDITIONAL_MEDIA')) {
    return false;
  }
  if (opts.stageCode === 'IMPRESSIONS_OR_SCANS') {
    const isScan = IMP_SCAN_CODES.has(opts.code);
    const isPhoto = IMP_PHOTO_CODES.has(opts.code);
    if (!isScan && !isPhoto) return true;

    const mode = opts.impressionCaptureMode as string | null | undefined;
    if (!mode) return false;
    if (mode === 'SCAN') return isScan;
    if (mode === 'IMPRESSION') return isPhoto;
    return true;
  }

  if (opts.mixedMediaBranches) {
    if (!opts.mediaBranchMode) return false;
    if (
      opts.mediaBranchMode !== MEDIA_BRANCH_ALL &&
      opts.mediaType &&
      opts.mediaType !== opts.mediaBranchMode
    ) {
      return false;
    }
  }
  return true;
}

function emptyResult(): CompletenessResult {
  return {
    isComplete: false,
    missingRequirements: [],
    rejectedRequirements: [],
    unconfirmedAssignments: [],
    missingClinicalFields: [],
    missingParticipants: [],
    missingRadiology: [],
    missingImplantRecords: [],
    dependencyBlockers: [],
    blockingReasons: [],
    warnings: [],
  };
}

function pushUnique(list: string[], value: string) {
  if (!list.includes(value)) list.push(value);
}

/**
 * Единственный источник истины для возможности закрытия этапа.
 * Frontend не вычисляет комплектность самостоятельно.
 */
export class StageCompletenessService {
  evaluate(input: StageCompletenessInput): CompletenessResult {
    const result = emptyResult();

    this.checkParticipants(input, result);
    this.checkDependency(input, result);
    this.checkMediaRequirements(input, result);
    this.checkClinicalFields(input, result);

    if (input.stageCode === 'POSTOP_SURGICAL_RADIOLOGY_CONTROL') {
      this.checkSurgicalRadiology(input, result);
    } else if (input.requirements.some((req) => isImplantSliceCardsRequirement(req))) {
      this.checkImplantSliceCards(input, result);
    }

    this.checkOwnership(input, result);
    this.checkStandaloneWarnings(input, result);

    // EmergencyEvent не закрывает этап и не снимает требования
    if ((input.emergencyEventsCount ?? 0) > 0) {
      result.warnings.push(
        'Зафиксировано неотложное событие. Требования этапа не сняты.',
      );
    }

    result.isComplete = result.blockingReasons.length === 0;
    return result;
  }

  canUserCloseStage(
    context: StageClosureContext,
    completeness: CompletenessResult,
  ): StageClosurePermissionResult {
    const blockingReasons: string[] = [];

    if (!completeness.isComplete) {
      blockingReasons.push(...completeness.blockingReasons);
    }

    if (
      !canCloseStage(context.closingUserRole, context.closingUserId, context.startedByUserId)
    ) {
      blockingReasons.push(
        'Закрыть этап может главный врач или врач, который начал этот этап.',
      );
    }

    return {
      canClose: blockingReasons.length === 0,
      blockingReasons: [...new Set(blockingReasons)],
    };
  }

  private ownerRoleToParticipantRole(ownerRole: OwnerRole | string): ParticipantRole | null {
    switch (ownerRole) {
      case OwnerRole.ORTHOPEDIST:
      case 'ORTHOPEDIST':
        return ParticipantRole.ORTHOPEDIST;
      case OwnerRole.SURGEON:
      case 'SURGEON':
        return ParticipantRole.SURGEON;
      case OwnerRole.CHIEF_DOCTOR:
      case 'CHIEF_DOCTOR':
        return ParticipantRole.CONSULTING_DOCTOR;
      default:
        return null;
    }
  }

  private checkParticipants(
    input: StageCompletenessInput,
    result: CompletenessResult,
  ) {
    const active = input.participants.filter((p) => !p.removedAt);
    for (const role of REQUIRED_PARTICIPANTS) {
      const primary = active.find((p) => p.role === role && p.isPrimary);
      if (!primary) {
        const label = this.participantLabel(role);
        pushUnique(result.missingParticipants, label);
        pushUnique(result.blockingReasons, `Не назначен primary-участник: ${label}.`);
      }
    }
  }

  private checkDependency(
    input: StageCompletenessInput,
    result: CompletenessResult,
  ) {
    const blocked =
      (input.closeBlockedUntilDependencyClosed ||
        input.startBlockedUntilDependencyClosed) &&
      input.dependsOnStageCode &&
      input.dependencyStageClosed === false;

    if (blocked) {
      const msg =
        input.stageCode === 'JAW_RELATION'
          ? 'Этап межчелюстных соотношений заблокирован: не закрыт послеоперационный хирургический и рентгенологический контроль.'
          : `Этап заблокирован: не закрыт зависимый этап ${input.dependsOnStageCode}.`;
      pushUnique(result.dependencyBlockers, msg);
      pushUnique(result.blockingReasons, msg);
    }
  }

  private checkMediaRequirements(
    input: StageCompletenessInput,
    result: CompletenessResult,
  ) {
    if (input.stageCode === 'IMPRESSIONS_OR_SCANS' && !input.impressionCaptureMode) {
      pushUnique(result.missingClinicalFields, 'impressionCaptureMode');
      pushUnique(
        result.blockingReasons,
        'Не выбран способ получения: скан или оттиск.',
      );
    }

    const mixedMediaBranches =
      input.stageCode !== 'IMPRESSIONS_OR_SCANS' && hasMixedMediaBranches(input.requirements);
    if (mixedMediaBranches && !input.mediaBranchMode) {
      pushUnique(result.missingClinicalFields, 'mediaBranchMode');
      pushUnique(
        result.blockingReasons,
        'Не выбран вид информации для закрытия этапа.',
      );
    }

    for (const req of input.requirements) {
      if (
        !isMediaRequirementEffectivelyRequired({
          stageCode: input.stageCode,
          impressionCaptureMode: input.impressionCaptureMode,
          mediaBranchMode: input.mediaBranchMode,
          mixedMediaBranches,
          code: req.code,
          mediaType: req.mediaType,
          templateRequired: req.required,
        })
      ) {
        continue;
      }
      // Structured data / confirmation handled in surgical checks
      if (
        req.mediaType === 'STRUCTURED_DATA' ||
        req.mediaType === 'STRUCTURED_CONFIRMATION' ||
        isImplantSliceCardsRequirement(req)
      ) {
        continue;
      }

      // КТ/КЛКТ и DICOM из протокола исключены — не блокируем комплектность
      if (
        req.mediaType === 'RADIOLOGY_STUDY' ||
        req.mediaType === 'DICOM_SERIES' ||
        req.code === 'POSTOP_CBCT_STUDY' ||
        req.code === 'POSTOP_IMPLANT_CT_SLICES' ||
        req.code.includes('CBCT') ||
        req.code.includes('DICOM')
      ) {
        continue;
      }

      const confirmedCount = this.countConfirmedForRequirement(input, req.code);
      const satisfiedViaStudy =
        req.code === 'POSTOP_OPTG' &&
        (input.radiologyStudies ?? []).some((s) => s.studyType === 'OPTG');

      if (confirmedCount < req.minCount && !satisfiedViaStudy) {
        pushUnique(result.missingRequirements, req.code);

        if (req.code === 'FP_VIDEO_SPEECH') {
          pushUnique(
            result.blockingReasons,
            'Отсутствует обязательное видео речи и фонетики.',
          );
        } else if (req.code === 'FP_VIDEO_FACE_DYNAMICS') {
          pushUnique(
            result.blockingReasons,
            'Отсутствует обязательное видео динамики лица, губ и улыбки.',
          );
        } else if (req.code === 'POSTOP_OPTG') {
          pushUnique(result.blockingReasons, 'Отсутствует послеоперационное ОПТГ.');
        } else {
          pushUnique(
            result.blockingReasons,
            `Отсутствует обязательный материал: ${req.name} (${req.code}).`,
          );
        }
      }

      // Speech video must have audio when confirmed
      if (req.code === 'FP_VIDEO_SPEECH' || req.qualityRequireAudio) {
        const speechAssets = input.mediaAssets.filter((a) =>
          a.assignments.some(
            (as) =>
              as.requirementCode === req.code &&
              as.status === 'CONFIRMED' &&
              !NON_COUNTABLE_STATUSES.has(a.status),
          ),
        );
        for (const asset of speechAssets) {
          if (asset.hasAudio === false) {
            pushUnique(
              result.blockingReasons,
              'Видео речи и фонетики должно содержать аудиодорожку.',
            );
          }
        }
      }
    }

    // Unconfirmed AI suggestions
    for (const asset of input.mediaAssets) {
      if (NON_COUNTABLE_STATUSES.has(asset.status)) continue;
      for (const as of asset.assignments) {
        if (as.source === 'AI' && as.status === 'SUGGESTED') {
          pushUnique(result.unconfirmedAssignments, asset.id);
          pushUnique(
            result.blockingReasons,
            'AI-предложение не подтверждено врачом.',
          );
        }
      }
    }
  }

  private countConfirmedForRequirement(
    input: StageCompletenessInput,
    requirementCode: string,
  ): number {
    let count = 0;
    for (const asset of input.mediaAssets) {
      if (NON_COUNTABLE_STATUSES.has(asset.status)) continue;
      const confirmed = asset.assignments.some(
        (a) =>
          a.requirementCode === requirementCode &&
          a.status === 'CONFIRMED' &&
          a.source !== 'AI', // AI alone never counts; but AI confirmed by doctor has status CONFIRMED with possibly still source AI — count CONFIRMED only
      );
      // Confirmed assignments count regardless of original source once doctor confirmed
      const doctorConfirmed = asset.assignments.some(
        (a) => a.requirementCode === requirementCode && a.status === 'CONFIRMED',
      );
      // SUGGESTED (AI) does not count
      if (doctorConfirmed && !confirmed) {
        // if only AI SUGGESTED, skip — handled above
      }
      if (doctorConfirmed) count += 1;
    }
    return count;
  }

  private checkClinicalFields(
    input: StageCompletenessInput,
    result: CompletenessResult,
  ) {
    if (input.stageCode !== 'JAW_RELATION') return;
    const fields = input.clinicalFields;
    if (!fields) {
      pushUnique(result.missingClinicalFields, 'structuredClinicalFields');
      pushUnique(
        result.blockingReasons,
        'Не заполнены структурированные поля межчелюстных соотношений.',
      );
      return;
    }
    if (!fields.desiredToothShade) {
      pushUnique(result.missingClinicalFields, 'desiredToothShade');
      pushUnique(
        result.blockingReasons,
        'Не выбран желаемый цвет зубов (положение «Желаемая форма зубов»).',
      );
    }
  }

  private checkSurgicalRadiology(
    input: StageCompletenessInput,
    result: CompletenessResult,
  ) {
    const studies = input.radiologyStudies ?? [];
    const hasOptgStudy = studies.some((s) => s.studyType === 'OPTG');
    const hasOptgMedia = this.countConfirmedForRequirement(input, 'POSTOP_OPTG') > 0;
    const hasOptg = hasOptgStudy || hasOptgMedia;

    if (!hasOptg) {
      pushUnique(result.missingRadiology, 'OPTG');
      pushUnique(result.blockingReasons, 'Отсутствует послеоперационное ОПТГ.');
    }

    this.checkImplantSliceCards(input, result);
  }

  private checkImplantSliceCards(
    input: StageCompletenessInput,
    result: CompletenessResult,
  ) {
    const implants = input.implants ?? [];
    const withSlices = implants.filter((implant) => implant.attachments.length > 0);
    if (withSlices.length === 0) {
      pushUnique(result.missingImplantRecords, 'SLICE');
      pushUnique(
        result.blockingReasons,
        'Не загружен ни один JPG-срез имплантата (пустые окна зубов допустимы).',
      );
    }

    for (const implant of withSlices) {
      const label = implant.implantLabel || `#${implant.implantNumber}`;
      if (implant.status === 'NEEDS_REVIEW') {
        pushUnique(
          result.blockingReasons,
          `Имплантат ${label} требует разбора руководителя/главного врача.`,
        );
      }
    }
  }

  private checkOwnership(
    input: StageCompletenessInput,
    result: CompletenessResult,
  ) {
    if (input.currentUserIsPrimaryOwner === false) {
      pushUnique(
        result.blockingReasons,
        `Закрыть этап может только primary ${input.ownerRole}.`,
      );
    }
  }

  private checkStandaloneWarnings(
    input: StageCompletenessInput,
    result: CompletenessResult,
  ) {
    // Absence of 1C link is NOT a blocker in standalone
    if (
      input.misProvider === 'none' ||
      input.stoma1cIntegrationEnabled === false
    ) {
      if (input.hasStoma1cLink === false) {
        result.warnings.push('Пациент не связан с 1С (предупреждение, не блокирует закрытие).');
      }
      return;
    }
    if (input.hasStoma1cLink === false) {
      result.warnings.push('Отсутствует связь с 1С (warning, не blocker).');
    }
  }

  private participantLabel(role: ParticipantRole): string {
    switch (role) {
      case ParticipantRole.CONSULTING_DOCTOR:
      case 'CONSULTING_DOCTOR' as ParticipantRole:
        return 'консультирующий врач';
      case ParticipantRole.ORTHOPEDIST:
      case 'ORTHOPEDIST' as ParticipantRole:
        return 'ортопед';
      case ParticipantRole.SURGEON:
      case 'SURGEON' as ParticipantRole:
        return 'хирург';
      case ParticipantRole.DENTAL_TECHNICIAN:
      case 'DENTAL_TECHNICIAN' as ParticipantRole:
        return 'зубной техник';
      default:
        return String(role);
    }
  }
}

export const stageCompletenessService = new StageCompletenessService();
