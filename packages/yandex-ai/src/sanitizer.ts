/** Принудительное отключение логирования данных Yandex AI */
export const YANDEX_DATA_LOGGING_HEADER = 'x-data-logging-enabled';
export const YANDEX_DATA_LOGGING_VALUE = 'false';

export interface SanitizedAiPayload {
  requestToken: string;
  sanitizedObjectUrl: string;
  mediaType: string;
  stageCode: string;
  requirementCodes: string[];
}

export interface RawAiPayload {
  patientName?: string;
  birthDate?: string;
  phone?: string;
  cardNumber?: string;
  stoma1cId?: string;
  branchName?: string;
  originalFileName?: string;
  [key: string]: unknown;
}

export function sanitizeAiPayload(raw: RawAiPayload, sanitizedUrl: string): SanitizedAiPayload {
  const requestToken = crypto.randomUUID();

  return {
    requestToken,
    sanitizedObjectUrl: sanitizedUrl,
    mediaType: String(raw.mediaType ?? 'unknown'),
    stageCode: String(raw.stageCode ?? 'unknown'),
    requirementCodes: Array.isArray(raw.requirementCodes)
      ? raw.requirementCodes.map(String)
      : [],
  };
}

export function redactForLogging(payload: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'patientName', 'lastName', 'firstName', 'middleName', 'birthDate',
    'phone', 'cardNumber', 'stoma1cId', 'branchName', 'originalFileName',
    'email', 'address', 'localPatientNumber',
  ];
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    redacted[key] = sensitiveKeys.includes(key) ? '[REDACTED]' : value;
  }
  return redacted;
}

export function getYandexAiHeaders(): Record<string, string> {
  return {
    [YANDEX_DATA_LOGGING_HEADER]: YANDEX_DATA_LOGGING_VALUE,
    'Content-Type': 'application/json',
  };
}
