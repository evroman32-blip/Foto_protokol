import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { AssignmentSource, AssignmentStatus } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { QueueService, QUEUE_NAMES } from '../queue/queue.service';
import { AuditAction } from '../../common/decorators/metadata.decorators';
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
  ) {}

  @Get()
  list(@Query('stageInstanceId') stageInstanceId: string) {
    if (!stageInstanceId) {
      throw new BadRequestException('Укажите stageInstanceId');
    }
    return this.prisma.mediaAsset.findMany({
      where: { stageInstanceId, archivedAt: null },
      include: { assignments: true, metadata: true, derivatives: true },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.mediaAsset.findUniqueOrThrow({
      where: { id },
      include: { assignments: true, metadata: true, derivatives: true },
    });
  }

  @Post(':id/assignment')
  @AuditAction('media.assign')
  assign(@Param('id') id: string, @Body() dto: AssignMediaDto) {
    return this.prisma.mediaAssignment.create({
      data: {
        mediaAssetId: id,
        requirementInstanceId: dto.requirementInstanceId ?? null,
        source: dto.source,
        status: dto.source === AssignmentSource.AI ? AssignmentStatus.SUGGESTED : AssignmentStatus.CONFIRMED,
      },
    });
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
  async reject(@Param('id') id: string, @Body() dto: RejectMediaDto) {
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

  @Post(':id/mark-additional')
  @AuditAction('media.markAdditional')
  markAdditional(@Param('id') id: string) {
    return this.prisma.mediaAsset.update({
      where: { id },
      data: { status: 'ADDITIONAL' },
    });
  }
}

@ApiTags('stages-media')
@Controller('stages/:stageId/media')
export class StageMediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Param('stageId') stageId: string) {
    return this.prisma.mediaAsset.findMany({
      where: { stageInstanceId: stageId, archivedAt: null },
      include: { assignments: true, metadata: true, derivatives: true },
      orderBy: { uploadedAt: 'desc' },
    });
  }
}

@Module({ controllers: [MediaController, StageMediaController] })
export class MediaModule {}