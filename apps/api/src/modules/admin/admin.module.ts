import {
  Body,
  Controller,
  Delete,
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
import { StagesModule } from '../stages/stages.module';
import { StageTemplateSyncService } from '../stages/stage-template-sync.service';

/** Короткий код метода: M1A, M2, M10A */
function parseShortMethodCode(raw: string): {
  code: string;
  methodNumber: number;
  submethodCode: string | null;
} | null {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  const match = /^M(\d{1,2})([A-Z])?$/.exec(code);
  if (!match) return null;
  return {
    code,
    methodNumber: Number(match[1]),
    submethodCode: match[2] ?? null,
  };
}

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
  @IsBoolean()
  isActive?: boolean;

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateSync: StageTemplateSyncService,
  ) {}

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
        isActive: dto.isActive ?? true,
      },
    });

    if (created.isActive) {
      await this.templateSync.backfillRequirementAcrossOpenStages(stage.id, created.id);
    }
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
      await this.templateSync.backfillRequirementAcrossOpenStages(
        updated.stageTemplateId,
        updated.id,
      );
    }

    return updated;
  }

  @Delete('media-requirements/:id')
  @AuditAction('admin.media-requirement.delete')
  async deleteMediaRequirement(@Param('id') id: string) {
    const riIds = (
      await this.prisma.requirementInstance.findMany({
        where: { mediaRequirementId: id },
        select: { id: true },
      })
    ).map((r) => r.id);
    if (riIds.length) {
      await this.prisma.mediaAssignment.updateMany({
        where: { requirementInstanceId: { in: riIds } },
        data: { requirementInstanceId: null },
      });
      await this.prisma.requirementInstance.deleteMany({
        where: { id: { in: riIds } },
      });
    }
    await this.prisma.mediaRequirement.delete({ where: { id } });
    return { ok: true };
  }

  @Get('implant-placement-methods')
  implantMethods(
    @Query('q') q?: string,
    @Query('jawScope') jawScope?: string,
    @Query('active') active?: string,
  ) {
    return this.prisma.implantPlacementMethod.findMany({
      where: {
        isActive: active === 'false' ? false : active === 'all' ? undefined : true,
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

  @Post('implant-placement-methods')
  @AuditAction('admin.implant-method.create')
  createImplantMethod(
    @Body()
    dto: {
      code: string;
      nameRu: string;
      jawScope?: string;
      sortOrder?: number;
      isActive?: boolean;
      methodNumber?: number;
      submethodCode?: string;
    },
  ) {
    const parsed = parseShortMethodCode(dto.code);
    if (!parsed || !dto.nameRu?.trim()) {
      throw new BadRequestException('Укажите код вида M1A / M2 и название');
    }
    return this.prisma.implantPlacementMethod.create({
      data: {
        code: parsed.code,
        methodNumber: parsed.methodNumber,
        submethodCode: parsed.submethodCode,
        nameRu: dto.nameRu.trim(),
        jawScope: (dto.jawScope as never) || 'BOTH',
        sortOrder: dto.sortOrder ?? parsed.methodNumber * 10,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Patch('implant-placement-methods/:id')
  @AuditAction('admin.implant-method.update')
  async updateImplantMethod(
    @Param('id') id: string,
    @Body()
    dto: {
      code?: string;
      nameRu?: string;
      methodNumber?: number;
      jawScope?: string;
      sortOrder?: number;
      isActive?: boolean;
      submethodCode?: string | null;
    },
  ) {
    const current = await this.prisma.implantPlacementMethod.findUniqueOrThrow({ where: { id } });
    const data: Record<string, unknown> = {};

    if (dto.nameRu !== undefined) data.nameRu = dto.nameRu.trim();
    if (dto.jawScope !== undefined) data.jawScope = dto.jawScope;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    let nextCode = current.code;
    if (dto.code !== undefined) {
      const parsed = parseShortMethodCode(dto.code);
      if (!parsed) throw new BadRequestException('Код должен быть вида M1A, M2, M10A');
      nextCode = parsed.code;
      data.code = parsed.code;
      data.methodNumber = parsed.methodNumber;
      data.submethodCode = parsed.submethodCode;
    } else {
      if (dto.methodNumber !== undefined) data.methodNumber = dto.methodNumber;
      if (dto.submethodCode !== undefined) {
        data.submethodCode = dto.submethodCode?.trim() || null;
      }
    }

    const updated = await this.prisma.implantPlacementMethod.update({
      where: { id },
      data: data as never,
    });

    if (nextCode !== current.code) {
      await this.prisma.surgicalImplantRecord.updateMany({
        where: { actualMethodCode: current.code },
        data: { actualMethodCode: nextCode },
      });
      await this.prisma.surgicalImplantRecord.updateMany({
        where: { plannedMethodCode: current.code },
        data: { plannedMethodCode: nextCode },
      });
    }

    return updated;
  }

  @Get('implant-types')
  implantTypes(@Query('active') active?: string) {
    return this.prisma.implantType.findMany({
      where:
        active === 'all'
          ? undefined
          : active === 'false'
            ? { isActive: false }
            : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameRu: 'asc' }],
    });
  }

  @Post('implant-types')
  @AuditAction('admin.implant-type.create')
  createImplantType(
    @Body()
    dto: {
      code: string;
      nameRu: string;
      brand?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!code || !dto.nameRu?.trim()) throw new BadRequestException('Укажите код и название');
    return this.prisma.implantType.create({
      data: {
        code,
        nameRu: dto.nameRu.trim(),
        brand: dto.brand?.trim() || null,
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  @Patch('implant-types/:id')
  @AuditAction('admin.implant-type.update')
  updateImplantType(
    @Param('id') id: string,
    @Body()
    dto: {
      nameRu?: string;
      brand?: string | null;
      description?: string | null;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.implantType.update({
      where: { id },
      data: {
        nameRu: dto.nameRu?.trim(),
        brand: dto.brand === undefined ? undefined : dto.brand?.trim() || null,
        description:
          dto.description === undefined ? undefined : dto.description?.trim() || null,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
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

@Module({
  imports: [StagesModule],
  controllers: [AdminController],
})
export class AdminModule {}
