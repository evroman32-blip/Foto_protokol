import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Module,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { createHash } from 'crypto';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../../common/services/prisma.service';
import { StageMediaAccessService } from '../../common/services/stage-media-access.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { QueueService, QUEUE_NAMES } from '../queue/queue.service';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';

type MultipartRequest = FastifyRequest & {
  file: () => Promise<{
    toBuffer: () => Promise<Buffer>;
    filename: string;
    mimetype: string;
    fields: Record<string, unknown>;
  } | undefined>;
};

function fieldValue(fields: Record<string, unknown>, name: string): string | undefined {
  const raw = fields[name];
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (!item || typeof item !== 'object') return undefined;
  const value = (item as { value?: unknown }).value;
  return typeof value === 'string' ? value : undefined;
}

class CreateBatchBody {
  @IsOptional()
  @IsUUID()
  stageInstanceId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalFiles?: number;
}

class InitFileBody {
  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  originalFileName?: string;

  @IsString()
  mimeType!: string;

  @IsOptional()
  @IsInt()
  size?: number;

  @IsOptional()
  @IsInt()
  fileSizeBytes?: number;
}

class CompleteFileBody {
  @IsOptional()
  @IsString()
  uploadId?: string;

  @IsOptional()
  @IsString()
  objectKey?: string;

  @IsOptional()
  @IsString()
  sha256?: string;

  @IsOptional()
  @IsString()
  originalFileName?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  fileSizeBytes?: number;
}

function isStlFile(mimeType: string, filename?: string | null) {
  const name = (filename ?? '').toLowerCase();
  const mime = (mimeType ?? '').toLowerCase();
  // Цветной скан exocad: .obj / .obj.zip (+ mtl/jpg внутри архива)
  if (
    name.endsWith('.obj') ||
    name.endsWith('.obj.zip') ||
    name.endsWith('.objbundle.zip') ||
    (name.endsWith('.zip') && name.includes('.obj')) ||
    mime === 'model/obj'
  ) {
    return true;
  }
  if (
    (mime === 'application/zip' || mime === 'application/x-zip-compressed') &&
    name.includes('obj')
  ) {
    return true;
  }
  return (
    name.endsWith('.stl') ||
    mime === 'model/stl' ||
    mime === 'application/sla' ||
    mime === 'application/vnd.ms-pki.stl' ||
    mime === 'model/x.stl-ascii' ||
    mime === 'model/x.stl-binary' ||
    mime.includes('stl')
  );
}

function inferMediaType(mimeType: string, filename?: string | null) {
  if (isStlFile(mimeType, filename)) return 'STL';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('image/')) return 'PHOTO';
  return 'DOCUMENT';
}

@ApiTags('upload')
@Controller()
export class UploadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly queue: QueueService,
    private readonly stageAccess: StageMediaAccessService,
  ) {}

  @Post('stages/:stageId/upload-batches')
  @AuditAction('upload.batch.create')
  async createBatchForStage(
    @Param('stageId') stageId: string,
    @Body() dto: CreateBatchBody,
    @CurrentUser() user: AuthUser,
  ) {
    const stageStatus = await this.stageAccess.assertCanMutateStage(stageId, user);
    return this.createBatchInternal(stageId, dto.totalFiles ?? 0, user.id, stageStatus);
  }

  @Post('upload/batches')
  @AuditAction('upload.batch.create')
  async createBatch(@Body() dto: CreateBatchBody, @CurrentUser() user: AuthUser) {
    if (!dto.stageInstanceId) throw new BadRequestException('Укажите stageInstanceId');
    const stageStatus = await this.stageAccess.assertCanMutateStage(dto.stageInstanceId, user);
    return this.createBatchInternal(
      dto.stageInstanceId,
      dto.totalFiles ?? 0,
      user.id,
      stageStatus,
    );
  }

  private async createBatchInternal(
    stageInstanceId: string,
    totalFiles: number,
    userId: string,
    stageStatus?: string,
  ) {
    const batch = await this.prisma.uploadBatch.create({
      data: {
        stageInstanceId,
        uploadedBy: userId,
        status: 'CREATED',
        totalFiles,
      },
    });
    // Правка закрытого этапа главным врачом не должна снимать статус CLOSED.
    if (!this.stageAccess.isClosed(stageStatus)) {
      await this.prisma.stageInstance.update({
        where: { id: stageInstanceId },
        data: { status: 'UPLOADING' },
      });
    }
    return { id: batch.id, batchId: batch.id, uploadBatchId: batch.id };
  }

  @Get('upload-batches/:batchId')
  getBatch(@Param('batchId') batchId: string) {
    return this.prisma.uploadBatch.findUniqueOrThrow({
      where: { id: batchId },
      include: { mediaAssets: true, chunks: true },
    });
  }

  @Get('upload/batches/:batchId')
  getBatchLegacy(@Param('batchId') batchId: string) {
    return this.getBatch(batchId);
  }

  @Post('upload-batches/:batchId/files/init')
  @AuditAction('upload.presign')
  async initFile(
    @Param('batchId') batchId: string,
    @Body() dto: InitFileBody,
    @CurrentUser() user: AuthUser,
  ) {
    await this.stageAccess.assertCanMutateByBatch(batchId, user);
    const batch = await this.prisma.uploadBatch.findUniqueOrThrow({ where: { id: batchId } });
    const filename = dto.originalFileName ?? dto.filename ?? 'file.bin';
    const objectKey = this.storage.buildObjectKey(`originals/${batch.stageInstanceId}`, filename);
    const { url } = await this.storage.getPresignedUploadUrl(objectKey, dto.mimeType);
    const uploadId = createHash('sha256')
      .update(`${batchId}:${objectKey}:${Date.now()}`)
      .digest('hex')
      .slice(0, 32);
    return {
      uploadUrl: url,
      objectKey,
      uploadId,
      sha256Placeholder: 'pending',
      mimeType: dto.mimeType,
      originalFileName: filename,
      fileSizeBytes: dto.fileSizeBytes ?? dto.size ?? 0,
    };
  }

  @Post('upload/batches/:batchId/presign')
  @AuditAction('upload.presign')
  async legacyPresign(
    @Param('batchId') batchId: string,
    @Body() dto: InitFileBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.initFile(batchId, dto, user);
  }

  /**
   * Загрузка файла через API → MinIO (внутренняя сеть).
   * Обходит браузерный PUT на signed URL (на демо ломается SignatureDoesNotMatch / CORS).
   */
  @Post('upload-batches/:batchId/files/put')
  @AuditAction('upload.put')
  async putFile(
    @Param('batchId') batchId: string,
    @Req() req: MultipartRequest,
    @CurrentUser() user: AuthUser,
  ) {
    await this.stageAccess.assertCanMutateByBatch(batchId, user);
    const batch = await this.prisma.uploadBatch.findUniqueOrThrow({ where: { id: batchId } });
    const part = await req.file();
    if (!part) throw new BadRequestException('Файл не передан');

    const buffer = await part.toBuffer();
    const objectKey =
      fieldValue(part.fields, 'objectKey') ||
      this.storage.buildObjectKey(`originals/${batch.stageInstanceId}`, part.filename || 'file.bin');
    const mimeType =
      fieldValue(part.fields, 'mimeType') || part.mimetype || 'application/octet-stream';

    await this.storage.putObject(objectKey, buffer, mimeType);
    return {
      ok: true,
      objectKey,
      fileSizeBytes: buffer.length,
      mimeType,
    };
  }

  @Post('upload/batches/:batchId/files/put')
  @AuditAction('upload.put')
  putFileLegacy(
    @Param('batchId') batchId: string,
    @Req() req: MultipartRequest,
    @CurrentUser() user: AuthUser,
  ) {
    return this.putFile(batchId, req, user);
  }

  @Post('upload-batches/:batchId/files/complete')
  @AuditAction('upload.file.complete')
  async completeFile(
    @Param('batchId') batchId: string,
    @Body() dto: CompleteFileBody,
    @CurrentUser() user: AuthUser,
  ) {
    await this.stageAccess.assertCanMutateByBatch(batchId, user);
    const batch = await this.prisma.uploadBatch.findUniqueOrThrow({ where: { id: batchId } });
    const objectKey =
      dto.objectKey ??
      this.storage.buildObjectKey(
        `originals/${batch.stageInstanceId}`,
        dto.originalFileName ?? dto.uploadId ?? 'file.bin',
      );
    const mimeType = dto.mimeType ?? 'application/octet-stream';
    const originalFileName = dto.originalFileName ?? 'upload.bin';
    const mediaType = inferMediaType(mimeType, originalFileName);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        stageInstanceId: batch.stageInstanceId,
        uploadBatchId: batch.id,
        originalFileName,
        storedObjectKey: objectKey,
        mimeType,
        mediaType,
        fileSizeBytes: BigInt(dto.fileSizeBytes ?? 0),
        sha256: dto.sha256 || createHash('sha256').update(objectKey).digest('hex'),
        status: 'UPLOADED',
        uploadedBy: user.id,
      },
    });

    await this.queue.addJob(QUEUE_NAMES.PROCESS_MEDIA, 'process', { mediaAssetId: asset.id });
    return {
      ...asset,
      fileSizeBytes:
        typeof asset.fileSizeBytes === 'bigint'
          ? Number(asset.fileSizeBytes)
          : asset.fileSizeBytes,
    };
  }

  @Post('upload-batches/:batchId/complete')
  @AuditAction('upload.batch.complete')
  async completeBatch(@Param('batchId') batchId: string) {
    const batch = await this.prisma.uploadBatch.update({
      where: { id: batchId },
      data: { status: 'PROCESSING', completedAt: new Date() },
    });
    await this.queue.addJob(QUEUE_NAMES.PROCESS_MEDIA, 'batch-complete', { uploadBatchId: batchId });
    return batch;
  }

  @Post('upload/batches/:batchId/complete')
  @AuditAction('upload.batch.complete')
  completeBatchLegacy(@Param('batchId') batchId: string) {
    return this.completeBatch(batchId);
  }
}

@Module({
  imports: [StorageModule, QueueModule],
  controllers: [UploadController],
  providers: [StageMediaAccessService],
})
export class UploadModule {}
