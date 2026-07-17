export * from './sanitizer';
export * from './mock';
export * from './yandex-studio-classifier';
export * from './alice-assistant';

import type { AiMediaClassifier, ClinicalAiAssistant } from '@mandarin/contracts';
import { MockAiMediaClassifier, MockClinicalAiAssistant } from './mock';
import { YandexAiStudioMediaClassifier } from './yandex-studio-classifier';
import { AliceAiClinicalAssistant } from './alice-assistant';

export interface AiProviderOptions {
  provider: 'mock' | 'yandex';
  yandexEnabled?: boolean;
  folderId?: string;
  modelUri?: string;
  flashModelUri?: string;
  timeoutMs?: number;
  maxRetries?: number;
  iamToken?: string;
}

export function createAiProviders(options: AiProviderOptions): {
  mediaClassifier: AiMediaClassifier;
  clinicalAssistant: ClinicalAiAssistant;
} {
  if (options.provider === 'mock' || !options.yandexEnabled) {
    return {
      mediaClassifier: new MockAiMediaClassifier(),
      clinicalAssistant: new MockClinicalAiAssistant(),
    };
  }

  return {
    mediaClassifier: new YandexAiStudioMediaClassifier({
      folderId: options.folderId ?? '',
      modelUri: options.modelUri ?? '',
      timeoutMs: options.timeoutMs ?? 60_000,
      maxRetries: options.maxRetries ?? 3,
      iamToken: options.iamToken,
    }),
    clinicalAssistant: new AliceAiClinicalAssistant(
      options.flashModelUri ?? options.modelUri ?? '',
      options.iamToken,
    ),
  };
}
