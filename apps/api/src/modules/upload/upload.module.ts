import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Module,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { createHash } from 'crypto';
import { PrismaService } from '../../common/services/prisma.service';
import { S3StorageService } from '../storage/s3-storage.service';
import { QueueService, QUEUE_NAMES } from '../queue/queue.service';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { StorageModule } from '../storage/storage.module';
import { QueueModule } from '../queue/queue.module';

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

@ApiTags('upload')
@Controller()
export class UploadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageService,
    private readonly queue: QueueService,
  ) {}

  @Post('stages/:stageId/upload-batches')
  @AuditAction('upload.batch.create')
  async createBatchForStage(
    @Param('stageId') stageId: string,
    @Body() dto: CreateBatchBody,
    @CurrentUser() user: AuthUser,
  ) {
    return this.createBatchInternal(stageId, dto.totalFiles ?? 0, user.id);
  }

  @Post('upload/batches')
  @AuditAction('upload.batch.create')
  async createBatch(@Body() dto: CreateBatchBody, @CurrentUser() user: AuthUser) {
    if (!dto.stageInstanceId) throw new BadRequestException('Укажите stageInstanceId');
    return this.createBatchInternal(dto.stageInstanceId, dto.totalFiles ?? 0, user.id);
  }

  private async createBatchInternal(stageInstanceId: string, totalFiles: number, userId: string) {
    const batch = await this.prisma.uploadBatch.create({
      data: {
        stageInstanceId,
        uploadedBy: userId,
        status: 'CREATED',
        totalFiles,
      },
    });
    await this.prisma.stageInstance.update({
      where: { id: stageInstanceId },
      data: { status: 'UPLOADING' },
    });
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
  async initFile(@Param('batchId') batchId: string, @Body() dto: InitFileBody) {
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
  async legacyPresign(@Param('batchId') batchId: string, @Body() dto: InitFileBody) {
    return this.initFile(batchId, dto);
  }

  @Post('upload-batches/:batchId/files/complete')
  @AuditAction('upload.file.complete')
  async completeFile(
    @Param('batchId') batchId: string,
    @Body() dto: CompleteFileBody,
    @CurrentUser() user: AuthUser,
  ) {
    const batch = await this.prisma.uploadBatch.findUniqueOrThrow({ where: { id: batchId } });
    const objectKey =
      dto.objectKey ??
      this.storage.buildObjectKey(
        `originals/${batch.stageInstanceId}`,
        dto.originalFileName ?? dto.uploadId ?? 'file.bin',
      );
    const mimeType = dto.mimeType ?? 'application/octet-stream';
    const mediaType = mimeType.startsWith('video/')
      ? 'VIDEO'
      : mimeType.startsWith('image/')
        ? 'PHOTO'
        : 'DOCUMENT';

    const asset = await this.prisma.mediaAsset.create({
      data: {
        stageInstanceId: batch.stageInstanceId,
        uploadBatchId: batch.id,
        originalFileName: dto.originalFileName ?? 'upload.bin',
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
    return asset;
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
})
export class UploadModule {}
