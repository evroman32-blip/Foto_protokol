import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/services/prisma.service';
import { Module } from '@nestjs/common';

@ApiTags('protocols')
@Controller('protocols')
export class ProtocolsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.protocol.findMany({
      where: { isActive: true },
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { publishedAt: 'desc' },
        },
      },
    });
  }

  @Get('versions/:versionId')
  getVersion(@Param('versionId') versionId: string) {
    return this.prisma.protocolVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        protocol: true,
        stageTemplates: { orderBy: { sortOrder: 'asc' } },
        mediaRequirements: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  @Get('versions/:versionId/templates')
  getTemplates(@Param('versionId') versionId: string) {
    return this.prisma.stageTemplate.findMany({
      where: { protocolVersionId: versionId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }
}

@Module({ controllers: [ProtocolsController] })
export class ProtocolsModule {}
