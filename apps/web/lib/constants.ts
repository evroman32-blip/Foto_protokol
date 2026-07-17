export const AUTH_TOKEN_KEY = 'mandarin_auth_token';
export const AUTH_COOKIE = 'mandarin_auth_token';

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3001';

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
  { id: 'cbct', title: '2. КТ / КЛКТ', description: 'Объёмное исследование челюстей' },
  { id: 'implants', title: '3. Реестр имплантатов', description: 'Установленные имплантаты' },
  { id: 'slices', title: '4. КТ-срезы', description: 'Срезы по каждому имплантату' },
  { id: 'methods', title: '5. Методы установки', description: 'Strategic Implant® метод/подметод' },
  { id: 'review', title: '6. Разбор и комментарии', description: 'Имплантаты на разбор' },
  { id: 'confirmation', title: '7. Подтверждение хирурга', description: 'Финальное подтверждение комплекта' },
] as const;
