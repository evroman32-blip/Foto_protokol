export const AUTH_TOKEN_KEY = 'mandarin_auth_token';
export const AUTH_COOKIE = 'mandarin_auth_token';

/** Browser: NEXT_PUBLIC_API_URL (can be same-origin ''). Server: API_URL → Nest. */
export const API_BASE = (
  (typeof window === 'undefined'
    ? process.env.API_URL || process.env.NEXT_PUBLIC_API_URL
    : process.env.NEXT_PUBLIC_API_URL) ?? 'http://localhost:3001'
).replace(/\/$/, '');

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

export const SURGICAL_RADIOLOGY_BLOCKS = [
  { id: 'optg', title: '1. ОПТГ', description: 'Ортопantomogramma после операции' },
  { id: 'slice-cards', title: '2. Карточки срезов', description: 'Челюсть, зуб, вид, метод, JPG' },
  { id: 'confirmation', title: '3. Подтверждение хирурга', description: 'Финальное подтверждение комплекта' },
] as const;
