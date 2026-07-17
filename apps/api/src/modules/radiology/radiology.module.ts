import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { RadiologyStudyType } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Module } from '@nestjs/common';

class CreateRadiologyDto {
  @IsUUID()
  clinicalCaseId!: string;

  @IsUUID()
  stageInstanceId!: string;

  @IsEnum(RadiologyStudyType)
  studyType!: RadiologyStudyType;

  @IsOptional()
  @IsString()
  comment?: string;
}

class UpdateRadiologyDto {
  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsUUID()
  mainMediaAssetId?: string;
}

@ApiTags('radiology')
@Controller('radiology/studies')
export class RadiologyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.radiologyStudy.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.radiologyStudy.findUniqueOrThrow({ where: { id } });
  }

  @Post()
  @AuditAction('radiology.create')
  create(@Body() dto: CreateRadiologyDto, @CurrentUser() user: AuthUser) {
    return this.prisma.radiologyStudy.create({
      data: { ...dto, uploadedBy: user.id },
    });
  }

  @Patch(':id')
  @AuditAction('radiology.update')
  update(@Param('id') id: string, @Body() dto: UpdateRadiologyDto) {
    return this.prisma.radiologyStudy.update({ where: { id }, data: dto });
  }

  @Delete(':id')
  @AuditAction('radiology.delete')
  remove(@Param('id') id: string) {
    return this.prisma.radiologyStudy.delete({ where: { id } });
  }
}

class CreateStageRadiologyDto {
  @IsEnum(RadiologyStudyType)
  studyType!: RadiologyStudyType;

  @IsOptional()
  @IsString()
  comment?: string;
}

@ApiTags('stages-radiology')
@Controller('stages/:stageId/radiology-studies')
export class StageRadiologyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Param('stageId') stageId: string) {
    return this.prisma.radiologyStudy.findMany({
      where: { stageInstanceId: stageId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post()
  @AuditAction('radiology.create')
  async create(
    @Param('stageId') stageId: string,
    @Body() dto: CreateStageRadiologyDto,
    @CurrentUser() user: AuthUser,
  ) {
    const stage = await this.prisma.stageInstance.findUniqueOrThrow({ where: { id: stageId } });
    return this.prisma.radiologyStudy.create({
      data: {
        clinicalCaseId: stage.clinicalCaseId,
        stageInstanceId: stageId,
        studyType: dto.studyType,
        comment: dto.comment,
        uploadedBy: user.id,
        status: 'READY',
      },
    });
  }
}

@Module({ controllers: [RadiologyController, StageRadiologyController] })
export class RadiologyModule {}
