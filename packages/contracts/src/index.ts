// =============================================================================
// @mandarin/contracts — shared enums, DTOs, and gateway interfaces
// =============================================================================

// --- Enums (runtime + type-safe) ---

export enum UserRole {
  /** Полные права управления сайтом. Не путать с должностью «Администратор клиники». */
  MODERATOR = 'MODERATOR',
  EXECUTIVE_DIRECTOR = 'EXECUTIVE_DIRECTOR',
  CLINIC_MANAGER = 'CLINIC_MANAGER',
  CLINIC_ADMINISTRATOR = 'CLINIC_ADMINISTRATOR',
  /** Права как у управляющего клиникой. */
  TREATMENT_CURATOR = 'TREATMENT_CURATOR',
  CHIEF_DOCTOR = 'CHIEF_DOCTOR',
  /** Устаревшая роль руководства; права как у управляющего клиникой. */
  ORTHOPEDIC_MANAGER = 'ORTHOPEDIC_MANAGER',
  SURGEON = 'SURGEON',
  ORTHOPEDIST = 'ORTHOPEDIST',
  CONSULTING_DOCTOR = 'CONSULTING_DOCTOR',
  DENTAL_TECHNICIAN = 'DENTAL_TECHNICIAN',
  ASSISTANT = 'ASSISTANT',
  RADIOLOGY_OPERATOR = 'RADIOLOGY_OPERATOR',
  AUDITOR = 'AUDITOR',
  EXPERT = 'EXPERT',
}

export const USER_ROLE_LABELS: Record<string, string> = {
  MODERATOR: 'Модератор',
  SYSTEM_ADMIN: 'Модератор',
  EXECUTIVE_DIRECTOR: 'Исполнительный директор',
  CLINIC_MANAGER: 'Управляющий клиникой',
  CLINIC_ADMINISTRATOR: 'Администратор клиники',
  TREATMENT_CURATOR: 'Куратор лечения',
  CHIEF_DOCTOR: 'Главный врач',
  ORTHOPEDIC_MANAGER: 'Управляющий клиникой',
  SURGEON: 'Хирург',
  ORTHOPEDIST: 'Ортопед',
  CONSULTING_DOCTOR: 'Консультирующий врач',
  DENTAL_TECHNICIAN: 'Зубной техник',
  ASSISTANT: 'Ассистент',
  RADIOLOGY_OPERATOR: 'Рентген-лаборант',
  AUDITOR: 'Аудитор',
  EXPERT: 'Эксперт',
};

/** Полные права управления сайтом. Генеральный директор = модератор. `SYSTEM_ADMIN` — прежнее имя. */
export function isModeratorRole(role: string | null | undefined): boolean {
  return role === UserRole.MODERATOR || role === 'SYSTEM_ADMIN';
}

export function isDoctorRole(role: string | null | undefined): boolean {
  return (
    role === UserRole.CHIEF_DOCTOR ||
    role === UserRole.SURGEON ||
    role === UserRole.ORTHOPEDIST ||
    role === UserRole.CONSULTING_DOCTOR
  );
}

export function isExpertRole(role: string | null | undefined): boolean {
  return role === UserRole.EXPERT;
}

/** Для эксперта ФИО пациента скрывается — остаётся номер карты. */
export function maskPatientFio<T>(patient: T): T {
  return {
    ...(patient as object),
    lastName: '',
    firstName: '',
    middleName: null,
  } as T;
}

/** Должность со словом «врач» (главный врач, врач стоматолог, врач и т.д.). */
export function isDoctorJobTitle(position: string | null | undefined): boolean {
  return Boolean(position && /врач/i.test(position));
}

export function isClinicalDoctor(
  role: string | null | undefined,
  position?: string | null,
): boolean {
  return isDoctorRole(role) || isDoctorJobTitle(position);
}

/** Управляющий клиникой, куратор лечения и прежняя роль ортопед-менеджер. */
export function isClinicManagerRole(role: string | null | undefined): boolean {
  return (
    role === UserRole.CLINIC_MANAGER ||
    role === UserRole.TREATMENT_CURATOR ||
    role === UserRole.ORTHOPEDIC_MANAGER
  );
}

/** Карточки сотрудников: ИД, управляющий/куратор, администратор клиники, главный врач (+ модератор). */
export function canEditStaffAndPatients(role: string | null | undefined): boolean {
  return (
    isModeratorRole(role) ||
    role === UserRole.EXECUTIVE_DIRECTOR ||
    isClinicManagerRole(role) ||
    role === UserRole.CLINIC_ADMINISTRATOR ||
    role === UserRole.CHIEF_DOCTOR
  );
}

/** Карточки пациентов: те же роли, что и сотрудники, плюс все врачи. */
export function canEditPatients(
  role: string | null | undefined,
  position?: string | null,
): boolean {
  return canEditStaffAndPatients(role) || isClinicalDoctor(role, position);
}

/** Создавать случай: все врачи (роль или должность со словом «врач»), управляющий/куратор, администратор клиники (+ модератор). */
export function canCreateClinicalCase(
  role: string | null | undefined,
  position?: string | null,
): boolean {
  return (
    isModeratorRole(role) ||
    isClinicalDoctor(role, position) ||
    isClinicManagerRole(role) ||
    role === UserRole.CLINIC_ADMINISTRATOR
  );
}

/** После закрытия этап правит только модератор. */
export function canEditClosedStage(role: string | null | undefined): boolean {
  return isModeratorRole(role);
}

/** Закрыть этап: главный врач или врач, который начал этап (+ модератор). */
export function canCloseStage(
  role: string | null | undefined,
  actorUserId: string,
  startedByUserId?: string | null,
): boolean {
  if (isModeratorRole(role) || role === UserRole.CHIEF_DOCTOR) return true;
  return Boolean(startedByUserId && startedByUserId === actorUserId);
}

export const STAFF_PATIENT_EDITOR_ROLES: UserRole[] = [
  UserRole.EXECUTIVE_DIRECTOR,
  UserRole.CLINIC_MANAGER,
  UserRole.TREATMENT_CURATOR,
  UserRole.CLINIC_ADMINISTRATOR,
  UserRole.CHIEF_DOCTOR,
  UserRole.ORTHOPEDIC_MANAGER,
];

export const PATIENT_EDITOR_ROLES: UserRole[] = [
  ...STAFF_PATIENT_EDITOR_ROLES,
  UserRole.SURGEON,
  UserRole.ORTHOPEDIST,
  UserRole.CONSULTING_DOCTOR,
];

export const CASE_CREATOR_ROLES: UserRole[] = [
  UserRole.CHIEF_DOCTOR,
  UserRole.SURGEON,
  UserRole.ORTHOPEDIST,
  UserRole.CONSULTING_DOCTOR,
  UserRole.CLINIC_MANAGER,
  UserRole.TREATMENT_CURATOR,
  UserRole.CLINIC_ADMINISTRATOR,
  UserRole.ORTHOPEDIC_MANAGER,
];

export enum UserAccountStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ParticipantRole {
  CONSULTING_DOCTOR = 'CONSULTING_DOCTOR',
  ORTHOPEDIST = 'ORTHOPEDIST',
  SURGEON = 'SURGEON',
  DENTAL_TECHNICIAN = 'DENTAL_TECHNICIAN',
}

/** Клинические роли на карточке сотрудника (назначает только модератор). */
export enum StaffClinicalRole {
  CONSULTING_DOCTOR = 'CONSULTING_DOCTOR',
  ORTHOPEDIST = 'ORTHOPEDIST',
  SURGEON_DENTIST = 'SURGEON_DENTIST',
  DENTAL_TECHNICIAN = 'DENTAL_TECHNICIAN',
  ANESTHESIOLOGIST = 'ANESTHESIOLOGIST',
  ENT_SURGEON = 'ENT_SURGEON',
}

export const STAFF_CLINICAL_ROLE_LABELS: Record<StaffClinicalRole, string> = {
  [StaffClinicalRole.CONSULTING_DOCTOR]: 'Консультирующий врач',
  [StaffClinicalRole.ORTHOPEDIST]: 'Ортопед',
  [StaffClinicalRole.SURGEON_DENTIST]: 'Стоматолог-хирург',
  [StaffClinicalRole.DENTAL_TECHNICIAN]: 'Зубной техник',
  [StaffClinicalRole.ANESTHESIOLOGIST]: 'Анестезиолог',
  [StaffClinicalRole.ENT_SURGEON]: 'ЛОР-хирург',
};

export const JOB_TITLES = [
  'Генеральный директор',
  'Исполнительный директор',
  'Управляющий клиникой',
  'Администратор клиники',
  'Куратор лечения',
  'Главный врач',
  'Врач стоматолог',
  'Зубной техник',
  'Гигиенист',
  'Врач',
  'Ассистент',
] as const;

export const JOB_TITLE_ALIASES: Record<string, string> = {
  'Управляющий филиалом': 'Управляющий клиникой',
  Администратор: 'Администратор клиники',
};

export function normalizeJobTitle(position: string): string {
  return JOB_TITLE_ALIASES[position] ?? position;
}

export const ACCEPTED_JOB_TITLES: readonly string[] = [
  ...JOB_TITLES,
  ...Object.keys(JOB_TITLE_ALIASES),
];

export type JobTitle = (typeof JOB_TITLES)[number];

export const JOB_TITLES_REQUIRING_SPECIALIZATION: readonly JobTitle[] = [
  'Главный врач',
  'Врач стоматолог',
  'Зубной техник',
  'Гигиенист',
  'Врач',
  'Ассистент',
];

export const SPECIALIZATIONS = [
  'Стоматология',
  'ЧЛХ',
  'Хирургия',
  'Ортопедия',
  'Гигиена ПР',
  'ЛОР',
  'Анестезиология',
] as const;

export type Specialization = (typeof SPECIALIZATIONS)[number];

export function jobTitleRequiresSpecialization(position: string): boolean {
  return (JOB_TITLES_REQUIRING_SPECIALIZATION as readonly string[]).includes(position);
}

export function requestedRoleFromJob(position: string, specialization?: string | null): UserRole {
  switch (normalizeJobTitle(position)) {
    case 'Генеральный директор':
      return UserRole.MODERATOR;
    case 'Исполнительный директор':
      return UserRole.EXECUTIVE_DIRECTOR;
    case 'Управляющий клиникой':
      return UserRole.CLINIC_MANAGER;
    case 'Администратор клиники':
      return UserRole.CLINIC_ADMINISTRATOR;
    case 'Куратор лечения':
      return UserRole.TREATMENT_CURATOR;
    case 'Главный врач':
      return UserRole.CHIEF_DOCTOR;
    case 'Зубной техник':
      return UserRole.DENTAL_TECHNICIAN;
    case 'Гигиенист':
    case 'Ассистент':
      return UserRole.ASSISTANT;
    case 'Врач стоматолог':
    case 'Врач':
      if (specialization === 'Хирургия' || specialization === 'ЧЛХ') return UserRole.SURGEON;
      if (specialization === 'Ортопедия') return UserRole.ORTHOPEDIST;
      if (specialization === 'Гигиена ПР') return UserRole.ASSISTANT;
      return UserRole.CONSULTING_DOCTOR;
    default:
      return UserRole.EXPERT;
  }
}

export enum StageCode {
  PRE_OPERATION = 'PRE_OPERATION',
  POSTOP_SURGICAL_RADIOLOGY_CONTROL = 'POSTOP_SURGICAL_RADIOLOGY_CONTROL',
  IMPRESSIONS_OR_SCANS = 'IMPRESSIONS_OR_SCANS',
  JAW_RELATION = 'JAW_RELATION',
  FIRST_PROTOTYPE = 'FIRST_PROTOTYPE',
  LONG_TERM_PROTOTYPE_FIXATION = 'LONG_TERM_PROTOTYPE_FIXATION',
  CONTROL_1_3_WEEKS = 'CONTROL_1_3_WEEKS',
  FINAL_PROSTHESIS_TRYIN = 'FINAL_PROSTHESIS_TRYIN',
  FINAL_FIXATION = 'FINAL_FIXATION',
  POST_FINAL_CONTROL = 'POST_FINAL_CONTROL',
  CORRECTIONS_REMAKES_COMPLICATIONS = 'CORRECTIONS_REMAKES_COMPLICATIONS',
}

/** IMPRESSIONS_OR_SCANS: доктор делает либо сканы, либо оттиски */
export enum ImpressionCaptureMode {
  SCAN = 'SCAN',
  IMPRESSION = 'IMPRESSION',
}

/** Выбор ветки комплектности на этапе с разными типами медиа. ALL = нужны все виды. */
export const MEDIA_BRANCH_ALL = 'ALL';

const MEDIA_BRANCH_TYPES = new Set(['PHOTO', 'VIDEO', 'DOCUMENT', 'STL', 'RADIOLOGY_IMAGE']);

export const MEDIA_BRANCH_LABELS: Record<string, string> = {
  PHOTO: 'Фото',
  VIDEO: 'Видео',
  DOCUMENT: 'Документ',
  STL: '3D-скан',
  RADIOLOGY_IMAGE: 'Рентген',
  ALL: 'Все виды',
};

export const IMPLANT_SLICE_CARDS_SPECIAL_RULE = 'everyImplantHasJpgSliceCard';
export const POSTOP_IMPLANT_SLICE_CARDS_CODE = 'POSTOP_IMPLANT_SLICE_CARDS';

/** Положение «Карточки срезов имплантатов (JPG)» — и встроенный код, и код из нового протокола. */
export function isImplantSliceCardsRequirement(req: {
  code?: string | null;
  name?: string | null;
  specialRule?: string | null;
}): boolean {
  if (req.specialRule === IMPLANT_SLICE_CARDS_SPECIAL_RULE) return true;
  const code = String(req.code ?? '').toUpperCase();
  if (code === POSTOP_IMPLANT_SLICE_CARDS_CODE) return true;
  if (code === 'KARTOCHKI_SREZOV_IMPLANTATOV_JPG' || code.startsWith('KARTOCHKI_SREZOV_IMPLANTATOV')) {
    return true;
  }
  const name = String(req.name ?? '').toLocaleLowerCase('ru');
  return name.includes('карточки срезов имплантат');
}

export function listMediaBranchTypes(
  requirements: Array<{
    required?: boolean;
    mediaType?: string;
    code?: string;
    name?: string;
    specialRule?: string | null;
  }>,
): string[] {
  const types = new Set<string>();
  for (const req of requirements) {
    if (!req.required) continue;
    const code = req.code ?? '';
    if (code === 'ADDITIONAL_MEDIA' || code.endsWith('_ADDITIONAL_MEDIA')) continue;
    if (isImplantSliceCardsRequirement(req)) continue;
    const mediaType = String(req.mediaType ?? '');
    if (!MEDIA_BRANCH_TYPES.has(mediaType)) continue;
    types.add(mediaType);
  }
  return [...types].sort();
}

export function hasMixedMediaBranches(
  requirements: Array<{
    required?: boolean;
    mediaType?: string;
    code?: string;
    name?: string;
    specialRule?: string | null;
  }>,
): boolean {
  return listMediaBranchTypes(requirements).length >= 2;
}

export enum StageOwnerRole {
  ORTHOPEDIST = 'ORTHOPEDIST',
  SURGEON = 'SURGEON',
  CHIEF_DOCTOR = 'CHIEF_DOCTOR',
  QUALITY_MANAGER = 'QUALITY_MANAGER',
}

/** Alias used by domain / Prisma OwnerRole */
export const OwnerRole = StageOwnerRole;
export type OwnerRole = StageOwnerRole;

export enum StageInstanceStatus {
  NOT_STARTED = 'NOT_STARTED',
  DRAFT = 'DRAFT',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  REVIEW_REQUIRED = 'REVIEW_REQUIRED',
  RESHOOT_REQUIRED = 'RESHOOT_REQUIRED',
  READY_FOR_CONFIRMATION = 'READY_FOR_CONFIRMATION',
  CONFIRMED = 'CONFIRMED',
  CLOSED = 'CLOSED',
  REOPENED = 'REOPENED',
  BLOCKED = 'BLOCKED',
}

export enum CaseStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
}

export enum MediaType {
  PHOTO = 'PHOTO',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  STL = 'STL',
  RADIOLOGY_IMAGE = 'RADIOLOGY_IMAGE',
  RADIOLOGY_STUDY = 'RADIOLOGY_STUDY',
  DICOM_SERIES = 'DICOM_SERIES',
  STRUCTURED_DATA = 'STRUCTURED_DATA',
  STRUCTURED_CONFIRMATION = 'STRUCTURED_CONFIRMATION',
}

export enum MediaAssetStatus {
  UPLOADED = 'UPLOADED',
  PROCESSING = 'PROCESSING',
  AI_SUGGESTED = 'AI_SUGGESTED',
  UNASSIGNED = 'UNASSIGNED',
  DOCTOR_CONFIRMED = 'DOCTOR_CONFIRMED',
  SURGEON_CONFIRMED = 'SURGEON_CONFIRMED',
  TECHNICALLY_REJECTED = 'TECHNICALLY_REJECTED',
  REPLACED = 'REPLACED',
  ADDITIONAL = 'ADDITIONAL',
  ARCHIVED = 'ARCHIVED',
}

export enum AssignmentSource {
  AI = 'AI',
  DOCTOR = 'DOCTOR',
  SURGEON = 'SURGEON',
}

export enum AssignmentStatus {
  SUGGESTED = 'SUGGESTED',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED',
  REPLACED = 'REPLACED',
}

export enum JawScope {
  UPPER = 'UPPER',
  LOWER = 'LOWER',
  BOTH = 'BOTH',
}

export enum RadiologyStudyType {
  OPTG = 'OPTG',
  CBCT = 'CBCT',
  CT = 'CT',
  OTHER = 'OTHER',
}

export enum RadiologyAttachmentType {
  CT_CROSS_SECTION = 'CT_CROSS_SECTION',
  CT_AXIAL = 'CT_AXIAL',
  CT_PANORAMIC_RECONSTRUCTION = 'CT_PANORAMIC_RECONSTRUCTION',
  CT_CORONAL = 'CT_CORONAL',
  CT_SAGITTAL = 'CT_SAGITTAL',
  OPTG_FRAGMENT = 'OPTG_FRAGMENT',
  OTHER = 'OTHER',
}

export enum ImplantSide {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
  MIDLINE = 'MIDLINE',
  UNKNOWN = 'UNKNOWN',
}

export const VALID_CT_ATTACHMENT_TYPES: RadiologyAttachmentType[] = [
  RadiologyAttachmentType.CT_CROSS_SECTION,
  RadiologyAttachmentType.CT_AXIAL,
  RadiologyAttachmentType.CT_PANORAMIC_RECONSTRUCTION,
];

export const MVP_STAGE_CODES = [
  StageCode.PRE_OPERATION,
  StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL,
  StageCode.JAW_RELATION,
  StageCode.FIRST_PROTOTYPE,
  StageCode.FINAL_FIXATION,
] as const;

export const ALL_STAGE_CODES = [
  StageCode.PRE_OPERATION,
  StageCode.POSTOP_SURGICAL_RADIOLOGY_CONTROL,
  StageCode.IMPRESSIONS_OR_SCANS,
  StageCode.JAW_RELATION,
  StageCode.FIRST_PROTOTYPE,
  StageCode.LONG_TERM_PROTOTYPE_FIXATION,
  StageCode.CONTROL_1_3_WEEKS,
  StageCode.FINAL_PROSTHESIS_TRYIN,
  StageCode.FINAL_FIXATION,
  StageCode.POST_FINAL_CONTROL,
  StageCode.CORRECTIONS_REMAKES_COMPLICATIONS,
] as const;

export const ADDITIONAL_MEDIA_CODE = 'ADDITIONAL_MEDIA';
export const PREOP_ADDITIONAL_MEDIA = 'PREOP_ADDITIONAL_MEDIA';
export const FF_ADDITIONAL_MEDIA = 'FF_ADDITIONAL_MEDIA';

export const SURGEON_RADIOLOGY_CONFIRMATION_TEXT =
  'Послеоперационное ОПТГ загружено и проверено. По каждому имплантату заполнена карточка (челюсть, зуб, вид, метод) и загружен JPG-срез с экрана КТ. Материалы позволяют передать пациента на следующий ортопедический этап либо требуют отдельного разбора, указанного в комментарии.';

export const ORTHODONTIC_CONFIRMATION_TEXT =
  'Фотографии и видеоматериалы относятся к указанному пациенту и клиническому этапу. Распределение проверено. Комплект соответствует фактически выполненному лечению.';

// --- Completeness DTO ---

export interface CompletenessResult {
  isComplete: boolean;
  missingRequirements: string[];
  rejectedRequirements: string[];
  unconfirmedAssignments: string[];
  missingClinicalFields: string[];
  missingParticipants: string[];
  missingRadiology: string[];
  missingImplantRecords: string[];
  dependencyBlockers: string[];
  blockingReasons: string[];
  warnings: string[];
}

export interface MediaRequirementSnapshot {
  id: string;
  code: string;
  name: string;
  mediaType: MediaType | string;
  required: boolean;
  minCount: number;
  specialRule?: string | null;
  qualityRequireAudio?: boolean | null;
}

export interface MediaAssetSnapshot {
  id: string;
  status: MediaAssetStatus | string;
  mediaType: MediaType | string;
  hasAudio?: boolean | null;
  assignments: Array<{
    requirementCode?: string | null;
    source: AssignmentSource | string;
    status: AssignmentStatus | string;
  }>;
}

export interface RadiologyStudySnapshot {
  studyType: RadiologyStudyType | 'OPTG' | 'CBCT' | 'CT' | 'OTHER';
  status: string;
}

export interface ImplantMethodSnapshot {
  code: string;
  requiresNerveRelation: boolean;
  requiresSinusRelation: boolean;
  requiresNasalFloorRelation: boolean;
  requiresPterygoidRelation: boolean;
  requiresZygomaticRelation: boolean;
  requiresCorticalTarget: boolean;
}

export interface ImplantAttachmentSnapshot {
  attachmentType: RadiologyAttachmentType | string;
  surgeonConfirmed: boolean;
  showsNerveRelation?: boolean | null;
  showsSinusRelation?: boolean | null;
  showsNasalFloorRelation?: boolean | null;
  showsPterygoidRelation?: boolean | null;
  showsZygomaticRelation?: boolean | null;
  showsCorticalEngagement?: boolean | null;
}

export interface ImplantRecordSnapshot {
  id: string;
  implantLabel: string;
  implantNumber: number;
  jawScope?: string | null;
  toothPositionFdi?: string | null;
  implantTypeId?: string | null;
  actualMethodCode: string | null;
  status: string;
  attachments: ImplantAttachmentSnapshot[];
}

export interface SurgeonConfirmationSnapshot {
  allImplantsDocumented: boolean;
  optgUploaded: boolean;
  cbctUploaded: boolean;
  allImplantsHaveCtSlices: boolean;
  allImplantsHaveMethodSelected: boolean;
  hasImplantsForReview: boolean;
}

export interface StageCompletenessInput {
  stageCode: string;
  stageStatus: StageInstanceStatus | string;
  ownerRole: StageOwnerRole | string;
  currentUserRole?: StageOwnerRole | ParticipantRole | string | null;
  currentUserIsPrimaryOwner?: boolean;
  misProvider?: 'none' | 'stoma1c';
  stoma1cIntegrationEnabled?: boolean;
  hasStoma1cLink?: boolean;
  participants: Array<{ role: ParticipantRole | string; isPrimary: boolean; removedAt?: Date | null }>;
  requirements: MediaRequirementSnapshot[];
  mediaAssets: MediaAssetSnapshot[];
  radiologyStudies?: RadiologyStudySnapshot[];
  implants?: ImplantRecordSnapshot[];
  methodsByCode?: Record<string, ImplantMethodSnapshot>;
  surgeonConfirmation?: SurgeonConfirmationSnapshot | null;
  doctorConfirmationPresent?: boolean;
  dependencyStageClosed?: boolean;
  dependsOnStageCode?: string | null;
  startBlockedUntilDependencyClosed?: boolean;
  closeBlockedUntilDependencyClosed?: boolean;
  clinicalFields?: {
    restHeightMm?: number | null;
    workingHeightMm?: number | null;
    registrationConclusion?: string | null;
    desiredToothShade?: string | null;
  };
  /** SCAN | IMPRESSION | null — только для IMPRESSIONS_OR_SCANS */
  impressionCaptureMode?: ImpressionCaptureMode | 'SCAN' | 'IMPRESSION' | null;
  /** PHOTO | VIDEO | STL | … | ALL | null — этап с несколькими типами медиа */
  mediaBranchMode?: string | null;
  emergencyEventsCount?: number;
}

export interface StageClosureContext {
  stageInstanceId: string;
  stageCode: StageCode | string;
  stageTemplateOwnerRole: StageOwnerRole | OwnerRole | string;
  stageStatus: StageInstanceStatus | string;
  closingUserId: string;
  closingUserRole: UserRole | string;
  closingUserStaffMemberId?: string | null;
  startedByUserId?: string | null;
  primaryParticipants: Array<{
    role: ParticipantRole | string;
    staffMemberId: string;
    userId: string | null;
    isPrimary: boolean;
  }>;
  misProvider?: 'none' | 'stoma1c';
  stoma1cIntegrationEnabled?: boolean;
  hasExternalPatientLink?: boolean;
  hasDoctorConfirmation?: boolean;
  hasSurgeonRadiologyConfirmation?: boolean;
  hasEmergencyEvents?: boolean;
}

export interface StageClosurePermissionResult {
  canClose: boolean;
  blockingReasons: string[];
}

export type StageCompletenessResult = CompletenessResult;
export type AttachmentType = RadiologyAttachmentType;

export enum PatientSex {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  UNSPECIFIED = 'UNSPECIFIED',
}

// --- Yandex AI ---

export interface AiClassificationInput {
  mediaAssetId: string;
  sanitizedObjectUrl: string;
  mimeType: string;
  mediaType: MediaType;
  stageCode: StageCode | string;
  requirementCodes: string[];
  requestToken: string;
}

export interface AiClassificationSuggestion {
  requirementCode: string;
  confidence: number;
  rationale?: string;
}

export interface AiClassificationResult {
  mediaAssetId: string;
  suggestions: AiClassificationSuggestion[];
  modelVersion: string;
  processedAt: string;
}

export interface BlockingReasonsInput {
  stageCode: StageCode | string;
  blockingReasons: string[];
  stageName: string;
}

export interface AssistantExplanation {
  summary: string;
  detailedItems: Array<{ reason: string; explanation: string; priority: 'high' | 'medium' | 'low' }>;
}

export interface StageSummaryInput {
  stageCode: StageCode | string;
  stageName: string;
  completenessPercent: number;
  confirmedMediaCount: number;
  totalRequiredCount: number;
}

export interface StageSummary {
  title: string;
  body: string;
  keyPoints: string[];
}

export interface AuditSummaryInput {
  clinicalCaseId: string;
  eventCount: number;
  periodDays: number;
}

export interface AuditSummary {
  summary: string;
  highlights: string[];
}

export interface ImplantMethodSuggestionInput {
  regionDescription: string;
  jawScope: JawScope;
  surgeonComment?: string;
}

export interface ImplantMethodSuggestion {
  methodCode: string;
  methodName: string;
  confidence: number;
  rationale: string;
}

export interface ImplantMethodSuggestionResult {
  suggestions: ImplantMethodSuggestion[];
  disclaimer: string;
}

export interface AiMediaClassifier {
  classify(input: AiClassificationInput): Promise<AiClassificationResult>;
  deleteRemoteAsset?(remoteAssetId: string): Promise<void>;
}

export interface ClinicalAiAssistant {
  explainBlockingReasons(input: BlockingReasonsInput): Promise<AssistantExplanation>;
  generateStageSummary(input: StageSummaryInput): Promise<StageSummary>;
  generateAuditSummary(input: AuditSummaryInput): Promise<AuditSummary>;
  suggestImplantMethod(input: ImplantMethodSuggestionInput): Promise<ImplantMethodSuggestionResult>;
}

// --- Stoma1c ---

export interface Stoma1cPatient {
  externalId: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  birthDate?: string;
  phone?: string;
  cardNumber?: string;
}

export interface Stoma1cPatientSearchQuery {
  query: string;
  limit?: number;
}

export interface Stoma1cStaffMember {
  externalId: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  position?: string;
  specialization?: string;
}

export interface Stoma1cBranch {
  externalId: string;
  name: string;
  address?: string;
}

export interface Stoma1cAppointment {
  externalId: string;
  patientExternalId: string;
  staffExternalId: string;
  scheduledAt: string;
  status: string;
}

export interface Stoma1cAppointmentQuery {
  from?: string;
  to?: string;
  branchExternalId?: string;
}

export interface PhotoProtocolStatusPayload {
  clinicalCaseId: string;
  stageInstanceId?: string;
  status: string;
  completenessPercent?: number;
  blockingReasons?: string[];
}

export interface PhotoProtocolReportPayload {
  clinicalCaseId: string;
  reportId: string;
  reportType: string;
  objectKey: string;
  generatedAt: string;
}

export interface Stoma1cGateway {
  getPatientById(patientId: string): Promise<Stoma1cPatient>;
  searchPatients(query: Stoma1cPatientSearchQuery): Promise<Stoma1cPatient[]>;
  getStaff(): Promise<Stoma1cStaffMember[]>;
  getBranches(): Promise<Stoma1cBranch[]>;
  getAppointments(query: Stoma1cAppointmentQuery): Promise<Stoma1cAppointment[]>;
  pushPhotoProtocolStatus(payload: PhotoProtocolStatusPayload): Promise<void>;
  attachPhotoProtocolReport(payload: PhotoProtocolReportPayload): Promise<void>;
}
