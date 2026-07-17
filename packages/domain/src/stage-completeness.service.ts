import {
  CompletenessResult,
  OwnerRole,
  StageClosureContext,
  StageClosurePermissionResult,
  StageCompletenessInput,
  UserRole,
  VALID_CT_ATTACHMENT_TYPES,
  ParticipantRole,
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
    } else if (!input.doctorConfirmationPresent) {
      pushUnique(result.blockingReasons, 'Отсутствует подтверждение врача.');
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

    const ownerParticipantRole = this.ownerRoleToParticipantRole(
      context.stageTemplateOwnerRole as OwnerRole,
    );

    if (ownerParticipantRole) {
      const primaryOwner = context.primaryParticipants.find(
        (p) => p.role === ownerParticipantRole && p.isPrimary,
      );
      const isPrimaryCloser = primaryOwner?.userId === context.closingUserId;
      const canOverride =
        context.closingUserRole === UserRole.SYSTEM_ADMIN ||
        context.closingUserRole === UserRole.CHIEF_DOCTOR;

      if (!isPrimaryCloser && !canOverride) {
        blockingReasons.push(
          `Закрыть этап может только primary ${context.stageTemplateOwnerRole}.`,
        );
      }
    }

    if (
      context.stageCode === 'POSTOP_SURGICAL_RADIOLOGY_CONTROL' &&
      !context.hasSurgeonRadiologyConfirmation
    ) {
      blockingReasons.push('Хирург не подтвердил рентгенологический комплект.');
    }

    if (
      context.stageCode !== 'POSTOP_SURGICAL_RADIOLOGY_CONTROL' &&
      !context.hasDoctorConfirmation
    ) {
      blockingReasons.push('Отсутствует подтверждение врача по этапу.');
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
    for (const req of input.requirements) {
      if (!req.required) continue;
      if (req.code === 'ADDITIONAL_MEDIA' || req.code.endsWith('_ADDITIONAL_MEDIA')) {
        continue;
      }
      // Structured data / confirmation handled in surgical checks
      if (
        req.mediaType === 'STRUCTURED_DATA' ||
        req.mediaType === 'STRUCTURED_CONFIRMATION'
      ) {
        continue;
      }

      const confirmedCount = this.countConfirmedForRequirement(input, req.code);

      if (confirmedCount < req.minCount) {
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
        } else if (req.code === 'POSTOP_CBCT_STUDY') {
          pushUnique(result.blockingReasons, 'Отсутствует послеоперационная КТ / КЛКТ.');
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
    if (fields.restHeightMm == null) {
      pushUnique(result.missingClinicalFields, 'restHeightMm');
      pushUnique(result.blockingReasons, 'Не указана высота покоя.');
    }
    if (fields.workingHeightMm == null) {
      pushUnique(result.missingClinicalFields, 'workingHeightMm');
      pushUnique(result.blockingReasons, 'Не указана рабочая высота.');
    }
    if (fields.registrationConclusion == null) {
      pushUnique(result.missingClinicalFields, 'registrationConclusion');
      pushUnique(result.blockingReasons, 'Не указано заключение по регистрации.');
    }
  }

  private checkSurgicalRadiology(
    input: StageCompletenessInput,
    result: CompletenessResult,
  ) {
    const studies = input.radiologyStudies ?? [];
    const hasOptg = studies.some((s) => s.studyType === 'OPTG');
    const hasCbct = studies.some(
      (s) => s.studyType === 'CBCT' || s.studyType === 'CT',
    );

    if (!hasOptg) {
      pushUnique(result.missingRadiology, 'OPTG');
      pushUnique(result.blockingReasons, 'Отсутствует послеоперационное ОПТГ.');
    }
    if (!hasCbct) {
      pushUnique(result.missingRadiology, 'CBCT');
      pushUnique(result.blockingReasons, 'Отсутствует послеоперационная КТ / КЛКТ.');
    }

    const implants = input.implants ?? [];
    if (implants.length === 0) {
      pushUnique(result.missingImplantRecords, 'REGISTRY');
      pushUnique(
        result.blockingReasons,
        'Не создан реестр установленных имплантатов.',
      );
    }

    for (const implant of implants) {
      if (!implant.actualMethodCode) {
        pushUnique(result.missingImplantRecords, implant.implantLabel);
        pushUnique(
          result.blockingReasons,
          `Имплантат ${implant.implantLabel} не привязан к методу установки.`,
        );
      }

      const confirmedSlice = implant.attachments.find(
        (a) =>
          a.surgeonConfirmed &&
          VALID_CT_ATTACHMENT_TYPES.includes(a.attachmentType as (typeof VALID_CT_ATTACHMENT_TYPES)[number]),
      );
      if (!confirmedSlice) {
        pushUnique(result.missingImplantRecords, `${implant.implantLabel}:CT`);
        pushUnique(
          result.blockingReasons,
          `Имплантат ${implant.implantLabel} не имеет подтверждённого КТ-среза.`,
        );
      }

      const method = implant.actualMethodCode
        ? input.methodsByCode?.[implant.actualMethodCode]
        : undefined;

      if (method && confirmedSlice) {
        const label = implant.implantLabel;
        if (method.requiresNerveRelation && confirmedSlice.showsNerveRelation !== true) {
          pushUnique(
            result.blockingReasons,
            `Имплантат ${label}: требуется подтверждение отображения нижнего альвеолярного нерва на КТ-срезе.`,
          );
        }
        if (method.requiresSinusRelation && confirmedSlice.showsSinusRelation !== true) {
          pushUnique(
            result.blockingReasons,
            `Имплантат ${label}: требуется подтверждение отображения верхнечелюстной пазухи на КТ-срезе.`,
          );
        }
        if (method.requiresNasalFloorRelation && confirmedSlice.showsNasalFloorRelation !== true) {
          pushUnique(
            result.blockingReasons,
            `Имплантат ${label}: требуется подтверждение отображения дна полости носа на КТ-срезе.`,
          );
        }
        if (method.requiresPterygoidRelation && confirmedSlice.showsPterygoidRelation !== true) {
          pushUnique(
            result.blockingReasons,
            `Имплантат ${label}: требуется подтверждение отображения бугорно-крыловидной зоны на КТ-срезе.`,
          );
        }
        if (method.requiresZygomaticRelation && confirmedSlice.showsZygomaticRelation !== true) {
          pushUnique(
            result.blockingReasons,
            `Имплантат ${label}: требуется подтверждение отображения скуловой зоны на КТ-срезе.`,
          );
        }
      }

      if (implant.status === 'NEEDS_REVIEW') {
        pushUnique(
          result.blockingReasons,
          `Имплантат ${implant.implantLabel} требует разбора руководителя/главного врача.`,
        );
      }
    }

    const conf = input.surgeonConfirmation;
    if (!conf) {
      pushUnique(
        result.blockingReasons,
        'Хирург не подтвердил рентгенологический комплект.',
      );
    } else {
      if (!conf.allImplantsDocumented || !conf.optgUploaded || !conf.cbctUploaded ||
          !conf.allImplantsHaveCtSlices || !conf.allImplantsHaveMethodSelected) {
        pushUnique(
          result.blockingReasons,
          'Хирург не подтвердил рентгенологический комплект.',
        );
      }
      if (conf.hasImplantsForReview) {
        pushUnique(
          result.blockingReasons,
          'Имеются имплантаты, требующие разбора руководителя/главного врача.',
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
