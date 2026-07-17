import { Injectable } from '@nestjs/common';
import { getEnv } from '@mandarin/config';
import {
  AiClassificationInput,
  AiClassificationResult,
  AssistantExplanation,
  AuditSummary,
  AuditSummaryInput,
  BlockingReasonsInput,
  ClinicalAiAssistant,
  ImplantMethodSuggestionInput,
  ImplantMethodSuggestionResult,
  StageSummary,
  StageSummaryInput,
} from '@mandarin/contracts';

@Injectable()
export class MockAiAssistant implements ClinicalAiAssistant {
  async explainBlockingReasons(input: BlockingReasonsInput): Promise<AssistantExplanation> {
    return {
      summary: `Этап «${input.stageName}» не может быть закрыт: ${input.blockingReasons.length} блокирующих причин.`,
      detailedItems: input.blockingReasons.map((reason, i) => ({
        reason,
        explanation: 'Рекомендуется устранить указанную проблему перед закрытием этапа.',
        priority: i === 0 ? 'high' : 'medium',
      })),
    };
  }

  async generateStageSummary(input: StageSummaryInput): Promise<StageSummary> {
    return {
      title: input.stageName,
      body: `Полнота этапа: ${input.completenessPercent}%. Подтверждено ${input.confirmedMediaCount} из ${input.totalRequiredCount} обязательных материалов.`,
      keyPoints: ['Проверьте неподтверждённые AI-назначения', 'Убедитесь в наличии всех видео'],
    };
  }

  async generateAuditSummary(input: AuditSummaryInput): Promise<AuditSummary> {
    return {
      summary: `За ${input.periodDays} дней зарегистрировано ${input.eventCount} событий аудита по случаю ${input.clinicalCaseId}.`,
      highlights: ['Изменения медиа', 'Попытки закрытия этапов'],
    };
  }

  async suggestImplantMethod(input: ImplantMethodSuggestionInput): Promise<ImplantMethodSuggestionResult> {
    return {
      suggestions: [
        {
          methodCode: 'M1.1',
          methodName: 'Кортикально-базальная установка (mock)',
          confidence: 0.75,
          rationale: `Регион: ${input.regionDescription}, челюсть: ${input.jawScope}`,
        },
      ],
      disclaimer: 'Подсказка AI не заменяет клиническое решение хирурга.',
    };
  }
}

@Injectable()
export class YandexAiAssistant implements ClinicalAiAssistant {
  private readonly headers: Record<string, string>;

  constructor() {
    const env = getEnv();
    this.headers = {
      Authorization: `Bearer ${env.YANDEX_IAM_TOKEN}`,
      'Content-Type': 'application/json',
      'x-data-logging-enabled': 'false',
    };
  }

  async explainBlockingReasons(input: BlockingReasonsInput): Promise<AssistantExplanation> {
    return new MockAiAssistant().explainBlockingReasons(input);
  }

  async generateStageSummary(input: StageSummaryInput): Promise<StageSummary> {
    return new MockAiAssistant().generateStageSummary(input);
  }

  async generateAuditSummary(input: AuditSummaryInput): Promise<AuditSummary> {
    return new MockAiAssistant().generateAuditSummary(input);
  }

  async suggestImplantMethod(input: ImplantMethodSuggestionInput): Promise<ImplantMethodSuggestionResult> {
    return new MockAiAssistant().suggestImplantMethod(input);
  }
}

export function createAiAssistant(): ClinicalAiAssistant {
  const env = getEnv();
  if (env.AI_PROVIDER === 'yandex' && env.YANDEX_AI_ENABLED) {
    return new YandexAiAssistant();
  }
  return new MockAiAssistant();
}

export class MockMediaClassifier {
  async classify(input: AiClassificationInput): Promise<AiClassificationResult> {
    return {
      mediaAssetId: input.mediaAssetId,
      suggestions: input.requirementCodes.slice(0, 1).map((code) => ({
        requirementCode: code,
        confidence: 0.82,
        rationale: 'Mock-классификация',
      })),
      modelVersion: 'mock-v1',
      processedAt: new Date().toISOString(),
    };
  }
}
