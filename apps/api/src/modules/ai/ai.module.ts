import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';
import { StageCode, JawScope } from '@mandarin/contracts';
import { createAiAssistant } from './ai-assistant.service';
import { Module, Injectable } from '@nestjs/common';

class ExplainBlockingDto {
  @IsString()
  stageCode!: StageCode;

  @IsString()
  stageName!: string;

  @IsArray()
  @IsString({ each: true })
  blockingReasons!: string[];
}

class StageSummaryDto {
  @IsString()
  stageCode!: StageCode;

  @IsString()
  stageName!: string;

  @IsNumber()
  completenessPercent!: number;

  @IsNumber()
  confirmedMediaCount!: number;

  @IsNumber()
  totalRequiredCount!: number;
}

class AuditSummaryDto {
  @IsUUID()
  clinicalCaseId!: string;

  @IsNumber()
  eventCount!: number;

  @IsNumber()
  periodDays!: number;
}

class SuggestImplantDto {
  @IsString()
  regionDescription!: string;

  @IsString()
  jawScope!: JawScope;

  @IsOptional()
  @IsString()
  surgeonComment?: string;
}

@Injectable()
export class AiService {
  private readonly assistant = createAiAssistant();

  explainBlocking(dto: ExplainBlockingDto) {
    return this.assistant.explainBlockingReasons(dto);
  }

  stageSummary(dto: StageSummaryDto) {
    return this.assistant.generateStageSummary(dto);
  }

  auditSummary(dto: AuditSummaryDto) {
    return this.assistant.generateAuditSummary(dto);
  }

  suggestImplant(dto: SuggestImplantDto) {
    return this.assistant.suggestImplantMethod(dto);
  }
}

@ApiTags('ai')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('explain-blocking-reasons')
  explainBlockingReasons(@Body() dto: ExplainBlockingDto) {
    return this.aiService.explainBlocking(dto);
  }

  @Post('explain-blocking')
  explainBlocking(@Body() dto: ExplainBlockingDto) {
    return this.aiService.explainBlocking(dto);
  }

  @Post('stage-summary')
  stageSummary(@Body() dto: StageSummaryDto) {
    return this.aiService.stageSummary(dto);
  }

  @Post('audit-summary')
  auditSummary(@Body() dto: AuditSummaryDto) {
    return this.aiService.auditSummary(dto);
  }

  @Post('suggest-implant-method')
  suggestImplant(@Body() dto: SuggestImplantDto) {
    return this.aiService.suggestImplant(dto);
  }
}

@Module({
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
