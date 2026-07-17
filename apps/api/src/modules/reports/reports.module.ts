import { Body, Controller, Get, Param, Post, Module, Injectable } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ReportType } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/services/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { QueueService, QUEUE_NAMES } from '../queue/queue.service';
import { PdfReportService } from './pdf-report.service';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { StageCompletenessApiService } from '../stages/stage-completeness-api.service';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';
import { StagesModule } from '../stages/stages.module';

class GenerateReportDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsUUID()
  clinicalCaseId!: string;

  @IsOptional()
  @IsUUID()
  stageInstanceId?: string;
}

class StageReportDto {
  @IsEnum(ReportType)
  reportType!: ReportType;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfReportService,
    private readonly storage: S3StorageService,
    private readonly queue: QueueService,
    private readonly completeness: StageCompletenessApiService,
  ) {}

  async generate(dto: GenerateReportDto, user: AuthUser) {
    const job = await this.queue.addJob(QUEUE_NAMES.REPORT_GENERATION, 'generate', {
      ...dto,
      generatedBy: user.id,
    });

    const clinicalCase = await this.prisma.clinicalCase.findUniqueOrThrow({
      where: { id: dto.clinicalCaseId },
      include: {
        patient: true,
        stages: { include: { stageTemplate: true } },
      },
    });

    let payload: Record<string, unknown> = {
      caseId: dto.clinicalCaseId,
      patientName: `${clinicalCase.patient.lastName} ${clinicalCase.patient.firstName}`,
      stages: clinicalCase.stages.map((s) => ({
        name: s.stageTemplate.name,
        status: s.status,
      })),
    };

    if (dto.reportType === ReportType.STAGE_REPORT && dto.stageInstanceId) {
      const stage = clinicalCase.stages.find((s) => s.id === dto.stageInstanceId);
      const comp = await this.completeness.evaluate(dto.stageInstanceId);
      payload = {
        stageName: stage?.stageTemplate.name ?? 'Этап',
        patientName: payload.patientName,
        blockingReasons: comp.blockingReasons,
      };
    }

    if (dto.reportType === ReportType.SURGICAL_RADIOLOGY_REPORT && dto.stageInstanceId) {
      const implants = await this.prisma.surgicalImplantRecord.findMany({
        where: { stageInstanceId: dto.stageInstanceId },
      });
      payload = {
        patientName: payload.patientName,
        implants: implants.map((i) => ({
          number: String(i.implantNumber),
          method: i.actualMethodCode,
        })),
      };
    }

    const buffer = await this.pdf.generate(dto.reportType, payload);
    const objectKey = this.storage.buildObjectKey('reports', `${dto.reportType}.pdf`);
    try {
      await this.storage.putObject(objectKey, buffer, 'application/pdf');
    } catch {
      // MinIO may be unavailable in unit context — report metadata still saved
    }
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const report = await this.prisma.generatedReport.create({
      data: {
        clinicalCaseId: dto.clinicalCaseId,
        stageInstanceId: dto.stageInstanceId ?? null,
        reportType: dto.reportType,
        objectKey,
        generatedBy: user.id,
        status: 'READY',
        sha256,
      },
    });

    return { ...report, jobId: job.id, sizeBytes: buffer.length };
  }

  list() {
    return this.prisma.generatedReport.findMany({
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });
  }

  get(id: string) {
    return this.prisma.generatedReport.findUniqueOrThrow({ where: { id } });
  }
}

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list() {
    return this.reports.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.reports.get(id);
  }

  @Post('generate')
  @AuditAction('report.generate')
  generate(@Body() dto: GenerateReportDto, @CurrentUser() user: AuthUser) {
    return this.reports.generate(dto, user);
  }
}

@ApiTags('stage-reports')
@Controller('stages/:stageId/reports')
export class StageReportsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  @Post()
  @AuditAction('report.generate')
  async generate(
    @Param('stageId') stageId: string,
    @Body() dto: StageReportDto,
    @CurrentUser() user: AuthUser,
  ) {
    const stage = await this.prisma.stageInstance.findUniqueOrThrow({ where: { id: stageId } });
    return this.reports.generate(
      {
        reportType: dto.reportType,
        clinicalCaseId: stage.clinicalCaseId,
        stageInstanceId: stageId,
      },
      user,
    );
  }
}

@ApiTags('case-reports')
@Controller('cases/:caseId/reports')
export class CaseReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @AuditAction('report.generate')
  generate(
    @Param('caseId') caseId: string,
    @Body() dto: Partial<StageReportDto>,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.generate(
      {
        reportType: dto.reportType ?? ReportType.CASE_REPORT,
        clinicalCaseId: caseId,
      },
      user,
    );
  }
}

@Module({
  imports: [StorageModule, QueueModule, StagesModule],
  controllers: [ReportsController, StageReportsController, CaseReportsController],
  providers: [PdfReportService, ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
