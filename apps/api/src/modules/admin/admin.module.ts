import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { MediaType, StageOwnerRole, UserRole } from '@mandarin/contracts';
import { getEnv, isStoma1cIntegrated } from '@mandarin/config';
import { PrismaService } from '../../common/services/prisma.service';
import { Roles, AuditAction } from '../../common/decorators/metadata.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Module } from '@nestjs/common';

class UpdateStageTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsEnum(StageOwnerRole)
  ownerRole?: StageOwnerRole;

  @IsOptional()
  @IsString()
  dependsOnStageCode?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class CreateMediaRequirementDto {
  @IsUUID()
  stageTemplateId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(MediaType)
  mediaType!: MediaType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxCount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  instruction?: string;
}

class UpdateMediaRequirementDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  minCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxCount?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  instruction?: string;
}

function mapProtocolVersion<T extends { protocol?: { name?: string; code?: string } | null; protocolId: string }>(
  row: T,
) {
  return {
    ...row,
    protocolName: row.protocol?.name ?? row.protocolId,
    protocolCode: row.protocol?.code ?? null,
  };
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN, UserRole.ORTHOPEDIC_MANAGER, UserRole.CHIEF_DOCTOR)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('protocol-versions')
  async listProtocolVersions() {
    const rows = await this.prisma.protocolVersion.findMany({
      include: { protocol: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(mapProtocolVersion);
  }

  @Get('protocols/:protocolId/versions/:versionId')
  async getProtocolVersion(
    @Param('protocolId') _protocolId: string,
    @Param('versionId') versionId: string,
  ) {
    const row = await this.prisma.protocolVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        protocol: true,
        stageTemplates: {
          orderBy: { sortOrder: 'asc' },
          include: {
            mediaRequirements: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
    return mapProtocolVersion(row);
  }

  @Patch('stage-templates/:id')
  @AuditAction('admin.stage-template.update')
  updateStageTemplate(@Param('id') id: string, @Body() dto: UpdateStageTemplateDto) {
    return this.prisma.stageTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        sortOrder: dto.sortOrder,
        ownerRole: dto.ownerRole,
        dependsOnStageCode: dto.dependsOnStageCode === undefined ? undefined : dto.dependsOnStageCode || null,
        isActive: dto.isActive,
      },
      include: { mediaRequirements: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  @Post('media-requirements')
  @AuditAction('admin.media-requirement.create')
  async createMediaRequirement(@Body() dto: CreateMediaRequirementDto) {
    const stage = await this.prisma.stageTemplate.findUniqueOrThrow({
      where: { id: dto.stageTemplateId },
    });
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!code) throw new BadRequestException('Укажите код требования');

    const created = await this.prisma.mediaRequirement.create({
      data: {
        protocolVersionId: stage.protocolVersionId,
        stageTemplateId: stage.id,
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        mediaType: dto.mediaType,
        required: dto.required ?? true,
        minCount: dto.minCount ?? (dto.required === false ? 0 : 1),
        maxCount: dto.maxCount ?? null,
        sortOrder: dto.sortOrder ?? 0,
        instruction: dto.instruction?.trim() || null,
        isActive: true,
      },
    });

    await this.backfillRequirementInstances(stage.id, created.id);
    return created;
  }

  @Patch('media-requirements/:id')
  @AuditAction('admin.media-requirement.update')
  async updateMediaRequirement(@Param('id') id: string, @Body() dto: UpdateMediaRequirementDto) {
    const updated = await this.prisma.mediaRequirement.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description === undefined ? undefined : dto.description?.trim() || null,
        mediaType: dto.mediaType,
        required: dto.required,
        minCount: dto.minCount,
        maxCount: dto.maxCount === undefined ? undefined : dto.maxCount,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
        instruction: dto.instruction === undefined ? undefined : dto.instruction?.trim() || null,
      },
    });

    if (updated.isActive) {
      await this.backfillRequirementInstances(updated.stageTemplateId, updated.id);
    }

    return updated;
  }

  /** Связать новое/реактивированное положение со всеми незакрытыми этапами случаев */
  private async backfillRequirementInstances(stageTemplateId: string, mediaRequirementId: string) {
    const openStages = await this.prisma.stageInstance.findMany({
      where: {
        stageTemplateId,
        status: { not: 'CLOSED' },
      },
      select: { id: true },
    });
    for (const stage of openStages) {
      await this.prisma.requirementInstance.upsert({
        where: {
          stageInstanceId_mediaRequirementId: {
            stageInstanceId: stage.id,
            mediaRequirementId,
          },
        },
        update: {},
        create: {
          stageInstanceId: stage.id,
          mediaRequirementId,
          status: 'PENDING',
        },
      });
    }
  }

  @Get('implant-placement-methods')
  implantMethods(
    @Query('q') q?: string,
    @Query('jawScope') jawScope?: string,
    @Query('active') active?: string,
  ) {
    return this.prisma.implantPlacementMethod.findMany({
      where: {
        isActive: active === 'false' ? false : true,
        jawScope: jawScope ? (jawScope as never) : undefined,
        OR: q
          ? [
              { code: { contains: q, mode: 'insensitive' } },
              { nameRu: { contains: q, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: [{ methodNumber: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  @Get('settings')
  settings() {
    const env = getEnv();
    return {
      misProvider: env.MIS_PROVIDER,
      stoma1cIntegrationEnabled: env.STOMA1C_INTEGRATION_ENABLED,
      aiProvider: env.AI_PROVIDER,
      maxSingleFileSizeMb: env.MAX_SINGLE_FILE_SIZE_MB,
    };
  }

  @Get('yandex-ai')
  yandexAi() {
    const env = getEnv();
    return {
      enabled: env.YANDEX_AI_ENABLED,
      provider: env.AI_PROVIDER,
      dataLoggingEnabled: env.YANDEX_DATA_LOGGING_ENABLED,
      folderId: env.YANDEX_CLOUD_FOLDER_ID ? '***configured***' : null,
    };
  }

  @Get('stoma1c')
  stoma1c() {
    const env = getEnv();
    return {
      enabled: isStoma1cIntegrated(env),
      provider: env.MIS_PROVIDER,
      baseUrl: env.STOMA1C_API_BASE_URL ?? null,
    };
  }
}

@Module({ controllers: [AdminController] })
export class AdminModule {}
