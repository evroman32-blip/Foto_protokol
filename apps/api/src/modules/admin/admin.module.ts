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
  ForbiddenException,
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
import { MediaType, StageOwnerRole, UserRole, isModeratorRole, isImplantSliceCardsRequirement, IMPLANT_SLICE_CARDS_SPECIAL_RULE } from '@mandarin/contracts';
import { getEnv, isStoma1cIntegrated } from '@mandarin/config';
import { ProtocolVersionStatus } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { Roles, AuditAction, SkipRoles } from '../../common/decorators/metadata.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { assertCanDelete } from '../../common/assert-can-delete';
import { Module } from '@nestjs/common';
import { StagesModule } from '../stages/stages.module';
import { StageTemplateSyncService } from '../stages/stage-template-sync.service';
import { USER_ROLE_LABELS } from '../auth/auth.service';

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

class CreateStageTemplateDto {
  @IsUUID()
  protocolVersionId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

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

class CreateProtocolDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsEnum(ProtocolVersionStatus)
  status?: ProtocolVersionStatus;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateProtocolDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateProtocolVersionDto {
  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsEnum(ProtocolVersionStatus)
  status?: ProtocolVersionStatus;
}

@ApiTags('admin')
@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.MODERATOR, UserRole.ORTHOPEDIC_MANAGER, UserRole.CHIEF_DOCTOR)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateSync: StageTemplateSyncService,
  ) {}

  @Get('account-requests')
  @Roles(UserRole.MODERATOR, UserRole.CHIEF_DOCTOR)
  async listAccountRequests(@Query('status') status?: string) {
    const accountStatus =
      status === 'APPROVED' || status === 'REJECTED' || status === 'PENDING' ? status : 'PENDING';
    const rows = await this.prisma.user.findMany({
      where: { accountStatus },
      include: { staffMember: { include: { branch: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((user) => ({
      id: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      roleLabel: USER_ROLE_LABELS[user.role] ?? user.role,
      requestedRole: user.requestedRole,
      requestedRoleLabel: user.requestedRole
        ? (USER_ROLE_LABELS[user.requestedRole] ?? user.requestedRole)
        : null,
      accountStatus: user.accountStatus,
      accentColor: user.accentColor,
      createdAt: user.createdAt,
      lastName: user.staffMember?.lastName ?? '',
      firstName: user.staffMember?.firstName ?? '',
      middleName: user.staffMember?.middleName ?? null,
      position: user.staffMember?.position ?? null,
      specialization: user.staffMember?.specialization ?? null,
    }));
  }

  @Post('users/:id/approve')
  @Roles(UserRole.MODERATOR, UserRole.CHIEF_DOCTOR)
  @AuditAction('auth.account.approve')
  async approveAccount(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const nextRole = user.requestedRole ?? user.role;
    if (
      (nextRole === UserRole.MODERATOR ||
        nextRole === UserRole.CHIEF_DOCTOR ||
        nextRole === UserRole.AUDITOR) &&
      !isModeratorRole(actor.role)
    ) {
      throw new ForbiddenException(
        'Назначить главного врача, модератора или аудитора может только модератор.',
      );
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        role: nextRole,
        accountStatus: 'APPROVED',
      },
      include: { staffMember: true },
    });
  }

  @Post('users/:id/reject')
  @Roles(UserRole.MODERATOR, UserRole.CHIEF_DOCTOR)
  @AuditAction('auth.account.reject')
  async rejectAccount(@Param('id') id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        role: UserRole.EXPERT,
        accountStatus: 'REJECTED',
      },
      include: { staffMember: true },
    });
  }

  @Get('protocol-versions')
  @SkipRoles()
  async listProtocolVersions() {
    const rows = await this.prisma.protocolVersion.findMany({
      include: { protocol: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(mapProtocolVersion);
  }

  @Get('protocols')
  async listProtocols() {
    const rows = await this.prisma.protocol.findMany({
      include: {
        versions: {
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return rows.map((p) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      versions: p.versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: v.status,
        publishedAt: v.publishedAt,
        createdAt: v.createdAt,
      })),
    }));
  }

  @Post('protocols')
  @AuditAction('admin.protocol.create')
  async createProtocol(@Body() dto: CreateProtocolDto, @CurrentUser() user: AuthUser) {
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    const name = dto.name.trim();
    const versionLabel = (dto.version?.trim() || '1.0').slice(0, 32);
    if (!code) throw new BadRequestException('Укажите код протокола');
    if (!name) throw new BadRequestException('Укажите название протокола');

    const exists = await this.prisma.protocol.findUnique({ where: { code } });
    if (exists) {
      throw new BadRequestException(`Протокол с кодом ${code} уже существует`);
    }

    const status = dto.status ?? ProtocolVersionStatus.DRAFT;
    const created = await this.prisma.protocol.create({
      data: {
        code,
        name,
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
        versions: {
          create: {
            version: versionLabel,
            status,
            publishedAt: status === ProtocolVersionStatus.PUBLISHED ? new Date() : null,
            createdBy: user.id,
          },
        },
      },
      include: {
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      description: created.description,
      isActive: created.isActive,
      versions: created.versions,
    };
  }

  @Patch('protocols/:id')
  @AuditAction('admin.protocol.update')
  async updateProtocol(@Param('id') id: string, @Body() dto: UpdateProtocolDto) {
    const data: {
      code?: string;
      name?: string;
      description?: string | null;
      isActive?: boolean;
    } = {};

    if (dto.code !== undefined) {
      const code = dto.code.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
      if (!code) throw new BadRequestException('Укажите код протокола');
      const clash = await this.prisma.protocol.findFirst({
        where: { code, NOT: { id } },
      });
      if (clash) throw new BadRequestException(`Протокол с кодом ${code} уже существует`);
      data.code = code;
    }
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Укажите название протокола');
      data.name = name;
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() || null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.protocol.update({
      where: { id },
      data,
      include: {
        versions: { orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }] },
      },
    });
  }

  @Patch('protocol-versions/:id')
  @AuditAction('admin.protocol-version.update')
  async updateProtocolVersion(@Param('id') id: string, @Body() dto: UpdateProtocolVersionDto) {
    const current = await this.prisma.protocolVersion.findUniqueOrThrow({ where: { id } });
    const data: {
      version?: string;
      status?: ProtocolVersionStatus;
      publishedAt?: Date | null;
    } = {};

    if (dto.version !== undefined) {
      const version = dto.version.trim();
      if (!version) throw new BadRequestException('Укажите номер версии');
      const clash = await this.prisma.protocolVersion.findFirst({
        where: {
          protocolId: current.protocolId,
          version,
          NOT: { id },
        },
      });
      if (clash) {
        throw new BadRequestException(`Версия ${version} уже есть у этого протокола`);
      }
      data.version = version;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === ProtocolVersionStatus.PUBLISHED && !current.publishedAt) {
        data.publishedAt = new Date();
      }
      if (dto.status === ProtocolVersionStatus.DRAFT) {
        data.publishedAt = null;
      }
    }

    const row = await this.prisma.protocolVersion.update({
      where: { id },
      data,
      include: { protocol: true },
    });
    return mapProtocolVersion(row);
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

  @Post('stage-templates')
  @AuditAction('admin.stage-template.create')
  async createStageTemplate(@Body() dto: CreateStageTemplateDto) {
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
    const name = dto.name.trim();
    if (!code) throw new BadRequestException('Укажите код этапа');
    if (!name) throw new BadRequestException('Укажите название этапа');

    await this.prisma.protocolVersion.findUniqueOrThrow({
      where: { id: dto.protocolVersionId },
    });

    const existing = await this.prisma.stageTemplate.findUnique({
      where: {
        protocolVersionId_code: {
          protocolVersionId: dto.protocolVersionId,
          code,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(`Этап с кодом ${code} уже есть в этой версии протокола`);
    }

    const maxSort = await this.prisma.stageTemplate.aggregate({
      where: { protocolVersionId: dto.protocolVersionId },
      _max: { sortOrder: true },
    });

    const created = await this.prisma.stageTemplate.create({
      data: {
        protocolVersionId: dto.protocolVersionId,
        code,
        name,
        description: dto.description?.trim() || null,
        sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
        ownerRole: dto.ownerRole ?? StageOwnerRole.ORTHOPEDIST,
        dependsOnStageCode: dto.dependsOnStageCode?.trim() || null,
        isActive: dto.isActive ?? true,
      },
      include: { mediaRequirements: { orderBy: { sortOrder: 'asc' } } },
    });

    if (created.isActive) {
      await this.templateSync.backfillStageTemplateAcrossOpenCases(created.id);
    }

    return created;
  }

  @Delete('stage-templates/:id')
  @Roles(UserRole.MODERATOR)
  @AuditAction('admin.stage-template.delete')
  async deleteStageTemplate(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    assertCanDelete(actor);
    const template = await this.prisma.stageTemplate.findUniqueOrThrow({
      where: { id },
      include: {
        mediaRequirements: { select: { id: true } },
        stageInstances: {
          select: {
            id: true,
            mediaAssets: {
              where: { archivedAt: null },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    const hasMedia = template.stageInstances.some((s) => s.mediaAssets.length > 0);
    if (hasMedia) {
      throw new BadRequestException(
        'Нельзя удалить этап: в случаях уже есть загруженные файлы по этому этапу',
      );
    }

    const stageIds = template.stageInstances.map((s) => s.id);
    const requirementIds = template.mediaRequirements.map((r) => r.id);

    // У пустых инстансов этапа снимаем положения и сами инстансы (без медиа).
    if (stageIds.length) {
      const riIds = (
        await this.prisma.requirementInstance.findMany({
          where: { stageInstanceId: { in: stageIds } },
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
      await this.prisma.uploadBatch.deleteMany({ where: { stageInstanceId: { in: stageIds } } });
      await this.prisma.stageInstance.deleteMany({ where: { id: { in: stageIds } } });
    }

    if (requirementIds.length) {
      const leftoverRi = (
        await this.prisma.requirementInstance.findMany({
          where: { mediaRequirementId: { in: requirementIds } },
          select: { id: true },
        })
      ).map((r) => r.id);
      if (leftoverRi.length) {
        await this.prisma.mediaAssignment.updateMany({
          where: { requirementInstanceId: { in: leftoverRi } },
          data: { requirementInstanceId: null },
        });
        await this.prisma.requirementInstance.deleteMany({
          where: { id: { in: leftoverRi } },
        });
      }
      await this.prisma.mediaRequirement.deleteMany({
        where: { id: { in: requirementIds } },
      });
    }

    await this.prisma.stageTemplate.delete({ where: { id } });
    return { ok: true };
  }

  @Post('media-requirements')
  @AuditAction('admin.media-requirement.create')
  async createMediaRequirement(@Body() dto: CreateMediaRequirementDto) {
    const stage = await this.prisma.stageTemplate.findUniqueOrThrow({
      where: { id: dto.stageTemplateId },
    });
    let code = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
    if (!code) throw new BadRequestException('Укажите код требования');

    // Авто-уникализация кода: длинные похожие названия раньше обрезались и конфликтовали
    const existingCodes = new Set(
      (
        await this.prisma.mediaRequirement.findMany({
          where: { stageTemplateId: stage.id },
          select: { code: true },
        })
      ).map((r) => r.code.toUpperCase()),
    );
    if (existingCodes.has(code)) {
      let n = 2;
      const base = code.slice(0, 90);
      let candidate = `${base}_${n}`;
      while (existingCodes.has(candidate)) {
        n += 1;
        candidate = `${base}_${n}`;
      }
      code = candidate;
    }

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
        specialRule: isImplantSliceCardsRequirement({ code, name: dto.name })
          ? IMPLANT_SLICE_CARDS_SPECIAL_RULE
          : undefined,
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
    const current = await this.prisma.mediaRequirement.findUniqueOrThrow({ where: { id } });
    const nextName = dto.name?.trim() ?? current.name;
    const sliceCards = isImplantSliceCardsRequirement({
      code: current.code,
      name: nextName,
      specialRule: current.specialRule,
    });
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
        ...(sliceCards ? { specialRule: IMPLANT_SLICE_CARDS_SPECIAL_RULE } : {}),
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
  @Roles(UserRole.MODERATOR)
  @AuditAction('admin.media-requirement.delete')
  async deleteMediaRequirement(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    assertCanDelete(actor);
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
