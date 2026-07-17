import type { AiMediaClassifier, AiClassificationInput, AiClassificationResult } from '@mandarin/contracts';
import { getYandexAiHeaders, redactForLogging, sanitizeAiPayload } from './sanitizer';

export interface YandexAiStudioConfig {
  folderId: string;
  modelUri: string;
  timeoutMs: number;
  maxRetries: number;
  iamToken?: string;
}

export class YandexAiStudioMediaClassifier implements AiMediaClassifier {
  constructor(private readonly config: YandexAiStudioConfig) {}

  async classify(input: AiClassificationInput): Promise<AiClassificationResult> {
    const sanitized = sanitizeAiPayload(
      {
        mediaType: input.mediaType,
        stageCode: input.stageCode,
        requirementCodes: input.requirementCodes,
      },
      input.sanitizedObjectUrl,
    );

    const headers = getYandexAiHeaders();
    if (headers['x-data-logging-enabled'] !== 'false') {
      throw new Error('Yandex AI: x-data-logging-enabled must be false');
    }

    // Scaffold: реальный HTTP-вызов к Yandex AI Studio будет добавлен при подключении credentials
    console.info('[YandexAI] classify request (redacted):', redactForLogging(sanitized as unknown as Record<string, unknown>));

    return {
      mediaAssetId: input.mediaAssetId,
      suggestions: [],
      modelVersion: 'yandex-studio-scaffold',
      processedAt: new Date().toISOString(),
    };
  }
}
