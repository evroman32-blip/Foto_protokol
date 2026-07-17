import type {
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
import { getYandexAiHeaders, redactForLogging } from './sanitizer';

export class AliceAiClinicalAssistant implements ClinicalAiAssistant {
  constructor(
    private readonly modelUri: string,
    private readonly iamToken?: string,
  ) {}

  private async callAlice(prompt: string, context: Record<string, unknown>): Promise<string> {
    const headers = getYandexAiHeaders();
    if (headers['x-data-logging-enabled'] !== 'false') {
      throw new Error('Yandex AI: x-data-logging-enabled must be false');
    }

    console.info('[AliceAI] request (redacted):', redactForLogging({ prompt: prompt.slice(0, 100), ...context }));
    return 'Scaffold-ответ Alice AI. Подключите credentials для production.';
  }

  async explainBlockingReasons(input: BlockingReasonsInput): Promise<AssistantExplanation> {
    await this.callAlice('explain_blocking', { stageCode: input.stageCode, count: input.blockingReasons.length });
    return {
      summary: `Этап «${input.stageName}» требует устранения блокировок.`,
      detailedItems: input.blockingReasons.map((reason) => ({
        reason,
        explanation: reason,
        priority: 'high' as const,
      })),
    };
  }

  async generateStageSummary(input: StageSummaryInput): Promise<StageSummary> {
    await this.callAlice('stage_summary', { stageCode: input.stageCode });
    return {
      title: input.stageName,
      body: 'Scaffold-сводка Alice AI',
      keyPoints: [],
    };
  }

  async generateAuditSummary(input: AuditSummaryInput): Promise<AuditSummary> {
    await this.callAlice('audit_summary', { caseId: input.clinicalCaseId });
    return { summary: 'Scaffold-аудит Alice AI', highlights: [] };
  }

  async suggestImplantMethod(_input: ImplantMethodSuggestionInput): Promise<ImplantMethodSuggestionResult> {
    return {
      suggestions: [],
      disclaimer: 'ИИ не подтверждает правильность установки имплантата.',
    };
  }
}
