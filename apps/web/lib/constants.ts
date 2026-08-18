export const AUTH_TOKEN_KEY = 'mandarin_auth_token';
export const AUTH_COOKIE = 'mandarin_auth_token';

function cleanApiBase(value: string | undefined, fallback: string): string {
  const raw = (value ?? '').replace(/[\u0000-\u001F]+/g, '').trim().replace(/\/+$/, '');
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
    return url.origin;
  } catch {
    return fallback;
  }
}

/**
 * Browser: empty NEXT_PUBLIC_API_URL = same origin (nginx /api/v1).
 * Never fall back to 127.0.0.1 in the browser — that is the visitor's PC, not the server.
 * Server: API_URL inside Docker → Nest.
 */
export const API_BASE = (
  typeof window === 'undefined'
    ? cleanApiBase(process.env.API_URL || process.env.NEXT_PUBLIC_API_URL, 'http://127.0.0.1:3001')
    : cleanApiBase(process.env.NEXT_PUBLIC_API_URL, '')
);

export const BRAND = {
  title: 'Mandarin PhotoProtocol',
  subtitle: 'Strategic Implant®',
} as const;

export const STAGE_TAB_LABELS: Record<string, string> = {
  photo: 'Фото',
  video: 'Видео',
  documents: 'Документы',
  radiology: 'Рентгенология',
  checklist: 'Чек-лист',
  history: 'История',
};

export const JAW_SCOPE_LABELS: Record<string, string> = {
  UPPER: 'Верхняя челюсть',
  LOWER: 'Нижняя челюсть',
  BOTH: 'Обе челюсти',
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активный',
  COMPLETED: 'Завершён',
  ARCHIVED: 'Архив',
};

export const STAGE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Не начат',
  DRAFT: 'Черновик',
  UPLOADING: 'Загрузка',
  PROCESSING: 'Обработка',
  REVIEW_REQUIRED: 'Требуется проверка',
  RESHOOT_REQUIRED: 'Требуется пересъёмка',
  READY_FOR_CONFIRMATION: 'Готов к подтверждению',
  CONFIRMED: 'Подтверждён',
  CLOSED: 'Закрыт',
  REOPENED: 'Переоткрыт',
  BLOCKED: 'Заблокирован',
};

export const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
  CONSULTING_DOCTOR: 'Консультирующий врач',
  ORTHOPEDIST: 'Ортопед',
  SURGEON: 'Хирург',
  DENTAL_TECHNICIAN: 'Зубной техник',
};

export {
  JOB_TITLES,
  JOB_TITLES_REQUIRING_SPECIALIZATION,
  SPECIALIZATIONS,
  STAFF_CLINICAL_ROLE_LABELS,
  StaffClinicalRole,
  USER_ROLE_LABELS,
  jobTitleRequiresSpecialization,
  isModeratorRole,
  canEditStaffAndPatients,
  canEditPatients,
  canCreateClinicalCase,
  canEditClosedStage,
  canCloseStage,
} from '@mandarin/contracts';

export const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Ожидает подтверждения',
  APPROVED: 'Подтверждён',
  REJECTED: 'Отклонён',
};

export const ACCENT_COLORS = [
  '#e85d04',
  '#1d4ed8',
  '#15803d',
  '#7c3aed',
  '#be185d',
  '#0f766e',
  '#b45309',
  '#334155',
  '#dc2626',
  '#0369a1',
] as const;

export const SURGICAL_RADIOLOGY_BLOCKS = [
  { id: 'optg', title: '1. ОПТГ', description: 'Ортопantomogramma после операции' },
  { id: 'slice-cards', title: '2. Карточки срезов', description: 'Челюсть, зуб, вид, метод, JPG' },
  { id: 'confirmation', title: '3. Подтверждение хирурга', description: 'Финальное подтверждение комплекта' },
] as const;
