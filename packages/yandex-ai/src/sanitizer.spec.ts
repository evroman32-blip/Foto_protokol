import { describe, it, expect } from 'vitest';
import { getYandexAiHeaders, YANDEX_DATA_LOGGING_HEADER } from './sanitizer';

describe('Yandex AI sanitizer', () => {
  it('forces x-data-logging-enabled=false', () => {
    const headers = getYandexAiHeaders();
    expect(headers[YANDEX_DATA_LOGGING_HEADER]).toBe('false');
  });
});
