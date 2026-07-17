import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@mandarin/contracts';
import { getEnv, isStoma1cIntegrated } from '@mandarin/config';
import { PrismaService } from '../../common/services/prisma.service';
import { Roles } from '../../common/decorators/metadata.decorators';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Module } from '@nestjs/common';

@ApiTags('admin')
@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN, UserRole.ORTHOPEDIC_MANAGER, UserRole.CHIEF_DOCTOR)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('protocol-versions')
  listProtocolVersions() {
    return this.prisma.protocolVersion.findMany({
      include: { protocol: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  @Get('protocols/:protocolId/versions/:versionId')
  getProtocolVersion(
    @Param('protocolId') _protocolId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.prisma.protocolVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        protocol: true,
        stageTemplates: { orderBy: { sortOrder: 'asc' } },
        mediaRequirements: { orderBy: { sortOrder: 'asc' } },
      },
    });
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
