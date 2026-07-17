import type {
  AiMediaClassifier,
  AiClassificationInput,
  AiClassificationResult,
  ClinicalAiAssistant,
  BlockingReasonsInput,
  AssistantExplanation,
  StageSummaryInput,
  StageSummary,
  AuditSummaryInput,
  AuditSummary,
  ImplantMethodSuggestionInput,
  ImplantMethodSuggestionResult,
} from '@mandarin/contracts';

export class MockAiMediaClassifier implements AiMediaClassifier {
  async classify(input: AiClassificationInput): Promise<AiClassificationResult> {
    const suggestion = input.requirementCodes[0];
    return {
      mediaAssetId: input.mediaAssetId,
      suggestions: suggestion
        ? [{ requirementCode: suggestion, confidence: 0.75, rationale: 'Mock-классификация для разработки' }]
        : [],
      modelVersion: 'mock-v1',
      processedAt: new Date().toISOString(),
    };
  }
}

export class MockClinicalAiAssistant implements ClinicalAiAssistant {
  async explainBlockingReasons(input: BlockingReasonsInput): Promise<AssistantExplanation> {
    return {
      summary: `Этап «${input.stageName}» не может быть закрыт.`,
      detailedItems: input.blockingReasons.map((reason) => ({
        reason,
        explanation: `Для закрытия этапа необходимо устранить: ${reason}`,
        priority: 'high' as const,
      })),
    };
  }

  async generateStageSummary(input: StageSummaryInput): Promise<StageSummary> {
    return {
      title: `Сводка: ${input.stageName}`,
      body: `Комплектность этапа: ${input.completenessPercent}%. Подтверждено ${input.confirmedMediaCount} из ${input.totalRequiredCount} обязательных позиций.`,
      keyPoints: ['Mock-сводка для разработки', 'ИИ не принимает клинических решений'],
    };
  }

  async generateAuditSummary(input: AuditSummaryInput): Promise<AuditSummary> {
    return {
      summary: `За ${input.periodDays} дней зарегистрировано ${input.eventCount} событий аудита по случаю.`,
      highlights: ['Mock-аудит для разработки'],
    };
  }

  async suggestImplantMethod(input: ImplantMethodSuggestionInput): Promise<ImplantMethodSuggestionResult> {
    return {
      suggestions: [],
      disclaimer:
        'ИИ не подтверждает правильность установки имплантата. Предложения носят справочный характер.',
    };
  }
}
