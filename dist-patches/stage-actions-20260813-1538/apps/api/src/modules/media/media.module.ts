import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import type { FastifyReply } from 'fastify';
import { AssignmentSource, AssignmentStatus } from '@mandarin/contracts';
import { isMediaRequirementEffectivelyRequired } from '@mandarin/domain';
import { PrismaService } from '../../common/services/prisma.service';
import { StageMediaAccessService } from '../../common/services/stage-media-access.service';
import { QueueService, QUEUE_NAMES } from '../queue/queue.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Module } from '@nestjs/common';

class AssignMediaDto {
  @IsOptional()
  @IsUUID()
  requirementInstanceId?: string;

  @IsOptional()
  @IsString()
  requirementCode?: string;

  @IsEnum(AssignmentSource)
  source!: AssignmentSource;
}

class RejectMediaDto {
  @IsString({ message: 'Укажите причину отклонения' })
  reason!: string;
}

@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly storage: S3StorageService,
    private readonly stageAccess: StageMediaAccessService,
  ) {}

  @Get()
  list(@Query('stageInstanceId') stageInstanceId: string) {
    if (!stageInstanceId) {
      throw new BadRequestException('Укажите stageInstanceId');
    }
    return this.prisma.mediaAsset.findMany({
      where: { stageInstanceId, archivedAt: null },
      include: {
        assignments: {
          include: { requirementInstance: { include: { mediaRequirement: true } } },
        },
        metadata: true,
        derivatives: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  @Get(':id/view-url')
  @AuditAction('media.view')
  async viewUrl(@Param('id') id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        assignments: {
          include: { requirementInstance: { include: { mediaRequirement: true } } },
        },
      },
    });
    if (!asset || asset.archivedAt) {
      throw new NotFoundException('Файл не найден');
    }
    const primary = asset.assignments.find((a) => a.status !== 'REJECTED') ?? asset.assignments[0];
    const title =
      primary?.requirementInstance?.mediaRequirement?.name ??
      primary?.requirementCode ??
      asset.originalFileName;
    const url = await this.storage.getPresignedDownloadUrl(asset.storedObjectKey);
    const preview = await this.prisma.mediaDerivative.findFirst({
      where: { mediaAssetId: id, type: 'PREVIEW' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return {
      id: asset.id,
      url,
      /** Same-origin: браузер грузит со cookie (без signed MinIO и без blob в JS) */
      contentPath: `/api/v1/media/${asset.id}/content`,
      previewPath: `/api/v1/media/${asset.id}/content?variant=preview`,
      mimeType: asset.mimeType,
      mediaType: asset.mediaType,
      originalFileName: asset.originalFileName,
      displayName: title,
      title,
      requirementCode:
        primary?.requirementCode ?? primary?.requirementInstance?.mediaRequirement?.code ?? null,
      fileSizeBytes: Number(asset.fileSizeBytes),
      hasPreview: Boolean(preview),
    };
  }

  /** Поток файла через API (preview/original). Стрим из MinIO + Cache-Control. */
  @Get(':id/content')
  @AuditAction('media.content')
  async content(
    @Param('id') id: string,
    @Query('variant') variant: string | undefined,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
    });
    if (!asset || asset.archivedAt) {
      throw new NotFoundException('Файл не найден');
    }

    let objectKey = asset.storedObjectKey;
    let mimeHint = asset.mimeType;
    const wantPreview = variant === 'preview' || variant === 'thumbnail';
    if (wantPreview) {
      const derType = variant === 'thumbnail' ? 'THUMBNAIL' : 'PREVIEW';
      const der = await this.prisma.mediaDerivative.findFirst({
        where: { mediaAssetId: id, type: derType },
        orderBy: { createdAt: 'desc' },
      });
      if (der) {
        objectKey = der.objectKey;
        mimeHint = der.mimeType;
      }
    }

    const { body, contentType, contentLength } = await this.storage.getObjectStream(objectKey);
    const mime =
      contentType ||
      mimeHint ||
      (asset.mediaType === 'STL' ? 'model/stl' : 'application/octet-stream');
    const rawName = (asset.originalFileName || 'file').replace(/["\r\n]/g, '');
    const asciiName = rawName.replace(/[^\x20-\x7E]/g, '_') || 'file';
    const encoded = encodeURIComponent(rawName);

    res.header('Cache-Control', 'private, max-age=86400');
    return new StreamableFile(body, {
      type: mime,
      disposition: `inline; filename="${asciiName}"; filename*=UTF-8''${encoded}`,
      ...(contentLength != null ? { length: contentLength } : {}),
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.mediaAsset.findUniqueOrThrow({
      where: { id },
      include: {
        assignments: {
          include: { requirementInstance: { include: { mediaRequirement: true } } },
        },
        metadata: true,
        derivatives: true,
      },
    });
  }

  @Post(':id/assignment')
  @AuditAction('media.assign')
  async assign(
    @Param('id') id: string,
    @Body() dto: AssignMediaDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.stageAccess.assertCanMutateByMediaAsset(id, user);
    const asset = await this.prisma.mediaAsset.findUniqueOrThrow({
      where: { id },
      include: { stageInstance: true },
    });

    // Положение шаблона этапа — источник истины для кода и mediaType
    let requirementCode = dto.requirementCode ?? null;
    let templateMediaType: string | null = null;
    if (dto.requirementInstanceId) {
      const ri = await this.prisma.requirementInstance.findUnique({
        where: { id: dto.requirementInstanceId },
        include: { mediaRequirement: { select: { code: true, mediaType: true } } },
      });
      if (ri) {
        requirementCode = requirementCode ?? ri.mediaRequirement.code;
        templateMediaType = ri.mediaRequirement.mediaType;
      }
    } else if (requirementCode) {
      const mr = await this.prisma.mediaRequirement.findFirst({
        where: {
          code: requirementCode,
          isActive: true,
          stageTemplateId: (
            await this.prisma.stageInstance.findUniqueOrThrow({
              where: { id: asset.stageInstanceId },
              select: { stageTemplateId: true },
            })
          ).stageTemplateId,
        },
        select: { mediaType: true },
      });
      templateMediaType = mr?.mediaType ?? null;
    }

    const assignment = await this.prisma.mediaAssignment.create({
      data: {
        mediaAssetId: id,
        requirementInstanceId: dto.requirementInstanceId ?? null,
        requirementCode,
        source: dto.source,
        status:
          dto.source === AssignmentSource.AI
            ? AssignmentStatus.SUGGESTED
            : AssignmentStatus.CONFIRMED,
        confirmedAt: dto.source === AssignmentSource.DOCTOR ? new Date() : null,
      },
    });

    await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        ...(dto.source === AssignmentSource.DOCTOR ? { status: 'DOCTOR_CONFIRMED' as const } : {}),
        ...(templateMediaType ? { mediaType: templateMediaType as never } : {}),
      },
    });

    // Связать загрузку ОПТГ с RadiologyStudy (КТ/КЛКТ исключены)
    if (requirementCode === 'POSTOP_OPTG' || requirementCode === 'G') {
      const studyType = 'OPTG';
      const existing = await this.prisma.radiologyStudy.findFirst({
        where: {
          stageInstanceId: asset.stageInstanceId,
          studyType,
        },
      });
      if (!existing) {
        await this.prisma.radiologyStudy.create({
          data: {
            clinicalCaseId: asset.stageInstance.clinicalCaseId,
            stageInstanceId: asset.stageInstanceId,
            studyType,
            mainMediaAssetId: asset.id,
            status: 'READY',
            uploadedBy: asset.uploadedBy,
          },
        });
      } else if (!existing.mainMediaAssetId || requirementCode === 'POSTOP_OPTG') {
        await this.prisma.radiologyStudy.update({
          where: { id: existing.id },
          data: { mainMediaAssetId: asset.id, status: 'READY' },
        });
      }
    }

    return assignment;
  }

  @Post(':id/confirm')
  @AuditAction('media.confirm')
  async confirm(@Param('id') id: string) {
    let assignment = await this.prisma.mediaAssignment.findFirst({
      where: { mediaAssetId: id },
      orderBy: { createdAt: 'desc' },
    });
    if (!assignment) {
      assignment = await this.prisma.mediaAssignment.create({
        data: {
          mediaAssetId: id,
          source: AssignmentSource.DOCTOR,
          status: AssignmentStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });
    } else {
      await this.prisma.mediaAssignment.update({
        where: { id: assignment.id },
        data: { status: AssignmentStatus.CONFIRMED, confirmedAt: new Date() },
      });
    }

    return this.prisma.mediaAsset.update({
      where: { id },
      data: { status: 'DOCTOR_CONFIRMED' },
    });
  }

  @Post(':id/reject')
  @AuditAction('media.reject')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectMediaDto,
    @CurrentUser() user: AuthUser,
  ) {
    await this.stageAccess.assertCanMutateByMediaAsset(id, user);
    await this.prisma.mediaAssignment.updateMany({
      where: { mediaAssetId: id },
      data: { status: AssignmentStatus.REJECTED },
    });
    return this.prisma.mediaAsset.update({
      where: { id },
      data: { status: 'TECHNICALLY_REJECTED' },
    });
  }

  @Post(':id/reprocess')
  @AuditAction('media.reprocess')
  async reprocess(@Param('id') id: string) {
    await this.queue.addJob(QUEUE_NAMES.PROCESS_MEDIA, 'reprocess', { mediaAssetId: id });
    return { mediaAssetId: id, status: 'queued' };
  }

  @Post(':id/archive')
  @AuditAction('media.archive')
  async archive(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.stageAccess.assertCanMutateByMediaAsset(id, user);
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        stageInstance: { include: { stageTemplate: true } },
        assignments: {
          include: {
            requirementInstance: { include: { mediaRequirement: true } },
          },
        },
      },
    });
    if (!asset || asset.archivedAt) {
      throw new NotFoundException('Файл не найден');
    }

    const primary =
      asset.assignments.find((a) => a.status !== 'REJECTED') ?? asset.assignments[0] ?? null;
    const ri = primary?.requirementInstance;
    const mr = ri?.mediaRequirement;

    if (ri && mr) {
      const effectivelyRequired = isMediaRequirementEffectivelyRequired({
        stageCode: asset.stageInstance.stageTemplate.code,
        impressionCaptureMode: asset.stageInstance.impressionCaptureMode,
        code: mr.code,
        templateRequired: mr.required,
      });
      const needed = Math.max(mr.minCount ?? 0, effectivelyRequired ? 1 : 0);
      if (needed > 0) {
        const siblings = await this.prisma.mediaAsset.findMany({
          where: {
            stageInstanceId: asset.stageInstanceId,
            archivedAt: null,
            id: { not: id },
            assignments: {
              some: {
                status: { not: AssignmentStatus.REJECTED },
                OR: [
                  { requirementInstanceId: ri.id },
                  { requirementCode: mr.code },
                ],
              },
            },
          },
        });
        if (siblings.length < needed) {
          throw new BadRequestException(
            `Нельзя удалить: для положения «${mr.name}» нужно минимум ${needed} файл(ов). Сначала загрузите замену или оставьте обязательный файл.`,
          );
        }
      }
    }

    return this.prisma.mediaAsset.update({
      where: { id },
      data: { archivedAt: new Date(), status: 'REPLACED' },
    });
  }

  @Post(':id/mark-additional')
  @AuditAction('media.markAdditional')
  async markAdditional(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.stageAccess.assertCanMutateByMediaAsset(id, user);
    return this.prisma.mediaAsset.update({
      where: { id },
      data: { status: 'ADDITIONAL' },
    });
  }
}

@ApiTags('stages-media')
@Controller('stages/:stageId/media')
export class StageMediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stageAccess: StageMediaAccessService,
  ) {}

  @Get()
  list(@Param('stageId') stageId: string) {
    return this.prisma.mediaAsset.findMany({
      where: { stageInstanceId: stageId, archivedAt: null },
      include: {
        assignments: {
          include: { requirementInstance: { include: { mediaRequirement: true } } },
        },
        metadata: true,
        derivatives: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  @Post('cleanup-duplicates')
  @AuditAction('media.cleanup-duplicates')
  async cleanupDuplicates(@Param('stageId') stageId: string, @CurrentUser() user: AuthUser) {
    await this.stageAccess.assertCanMutateStage(stageId, user);
    const stage = await this.prisma.stageInstance.findUnique({
      where: { id: stageId },
      include: {
        stageTemplate: true,
        requirementInstances: {
          where: { mediaRequirement: { isActive: true } },
          include: { mediaRequirement: true },
        },
        mediaAssets: {
          where: { archivedAt: null },
          include: {
            assignments: {
              include: { requirementInstance: { include: { mediaRequirement: true } } },
            },
          },
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });
    if (!stage) throw new NotFoundException('Этап не найден');

    const toArchive: string[] = [];

    for (const ri of stage.requirementInstances) {
      const mr = ri.mediaRequirement;
      const effectivelyRequired = isMediaRequirementEffectivelyRequired({
        stageCode: stage.stageTemplate.code,
        impressionCaptureMode: stage.impressionCaptureMode,
        code: mr.code,
        templateRequired: mr.required,
      });
      const needed = Math.max(mr.minCount ?? 0, effectivelyRequired ? 1 : 0);
      const files = stage.mediaAssets.filter((asset) =>
        asset.assignments.some(
          (a) =>
            a.status !== AssignmentStatus.REJECTED &&
            (a.requirementInstanceId === ri.id || a.requirementCode === mr.code),
        ),
      );
      // newest first (already ordered desc)
      const keep = needed > 0 ? files.slice(0, needed) : [];
      const extras = files.filter((f) => !keep.some((k) => k.id === f.id));
      for (const extra of extras) toArchive.push(extra.id);
    }

    // Unassigned / orphan files on the stage — archive all
    for (const asset of stage.mediaAssets) {
      const hasActiveAssignment = asset.assignments.some((a) => a.status !== AssignmentStatus.REJECTED);
      if (!hasActiveAssignment && !toArchive.includes(asset.id)) {
        toArchive.push(asset.id);
      }
    }

    if (toArchive.length) {
      await this.prisma.mediaAsset.updateMany({
        where: { id: { in: toArchive } },
        data: { archivedAt: new Date(), status: 'REPLACED' },
      });
    }

    return {
      stageInstanceId: stageId,
      archivedCount: toArchive.length,
      archivedIds: toArchive,
      message:
        toArchive.length > 0
          ? `Удалено лишних файлов: ${toArchive.length}. Обязательный минимум по положениям сохранён.`
          : 'Лишних файлов не найдено.',
    };
  }
}

@Module({
  controllers: [MediaController, StageMediaController],
  providers: [StageMediaAccessService],
})
export class MediaModule {}