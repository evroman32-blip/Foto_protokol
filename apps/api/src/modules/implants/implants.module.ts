import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createHash } from 'crypto';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import {
  ImplantSide,
  JawScope,
  SURGEON_RADIOLOGY_CONFIRMATION_TEXT,
} from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Module } from '@nestjs/common';

function sideFromTooth(tooth?: string | null): ImplantSide {
  if (!tooth) return ImplantSide.UNKNOWN;
  const n = Number(tooth);
  if ([11, 12, 13, 14, 15, 16, 17, 18, 41, 42, 43, 44, 45, 46, 47, 48].includes(n)) {
    return ImplantSide.RIGHT;
  }
  if ([21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38].includes(n)) {
    return ImplantSide.LEFT;
  }
  return ImplantSide.UNKNOWN;
}

class CreateImplantDto {
  @IsInt()
  @Min(1)
  implantNumber!: number;

  @IsOptional()
  @IsString()
  implantLabel?: string;

  @IsEnum(JawScope)
  jawScope!: JawScope;

  @IsOptional()
  @IsEnum(ImplantSide)
  side?: ImplantSide;

  @IsOptional()
  @IsString()
  toothPositionFdi?: string;

  @IsOptional()
  @IsUUID()
  implantTypeId?: string;

  @IsOptional()
  @IsString()
  actualMethodCode?: string;
}

class UpdateImplantDto {
  @IsOptional()
  @IsEnum(JawScope)
  jawScope?: JawScope;

  @IsOptional()
  @IsEnum(ImplantSide)
  side?: ImplantSide;

  @IsOptional()
  @IsString()
  toothPositionFdi?: string | null;

  @IsOptional()
  @IsUUID()
  implantTypeId?: string | null;

  @IsOptional()
  @IsString()
  actualMethodCode?: string;

  @IsOptional()
  @IsString()
  implantLabel?: string;

  @IsOptional()
  @IsString()
  surgeonComment?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

class AttachRadiologyDto {
  @IsUUID()
  mediaAssetId!: string;

  @IsOptional()
  @IsString()
  attachmentType?: string;

  @IsOptional()
  @IsBoolean()
  surgeonConfirmed?: boolean;
}

class ConfirmSurgeonDto {
  @IsBoolean()
  allImplantsDocumented!: boolean;

  @IsBoolean()
  optgUploaded!: boolean;

  @IsBoolean()
  cbctUploaded!: boolean;

  @IsBoolean()
  allImplantsHaveCtSlices!: boolean;

  @IsBoolean()
  allImplantsHaveMethodSelected!: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}

@ApiTags('implants')
@Controller()
export class ImplantsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('implants/methods')
  methods() {
    return this.prisma.implantPlacementMethod.findMany({
      where: { isActive: true },
      orderBy: [{ methodNumber: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  @Get('implants/types')
  types() {
    return this.prisma.implantType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { nameRu: 'asc' }],
    });
  }

  @Get('implant-records/:id')
  getRecord(@Param('id') id: string) {
    return this.prisma.surgicalImplantRecord.findUniqueOrThrow({
      where: { id },
      include: {
        implantType: true,
        radiologyAttachments: { include: { mediaAsset: true } },
      },
    });
  }

  @Patch('implant-records/:id')
  @AuditAction('implant.update')
  update(@Param('id') id: string, @Body() dto: UpdateImplantDto) {
    const data: Record<string, unknown> = { ...dto };
    if (dto.toothPositionFdi !== undefined && dto.side === undefined) {
      data.side = sideFromTooth(dto.toothPositionFdi);
    }
    return this.prisma.surgicalImplantRecord.update({
      where: { id },
      data: data as never,
      include: {
        implantType: true,
        radiologyAttachments: { include: { mediaAsset: true } },
      },
    });
  }

  @Delete('implant-records/:id')
  @AuditAction('implant.delete')
  remove(@Param('id') id: string) {
    return this.prisma.surgicalImplantRecord.delete({ where: { id } });
  }

  @Get('stages/:stageId/implant-records')
  stageRecords(@Param('stageId') stageId: string) {
    return this.prisma.surgicalImplantRecord.findMany({
      where: { stageInstanceId: stageId },
      include: {
        implantType: true,
        radiologyAttachments: { include: { mediaAsset: true } },
      },
      orderBy: { implantNumber: 'asc' },
    });
  }

  @Post('stages/:stageId/implant-records')
  @AuditAction('implant.create')
  async createForStage(
    @Param('stageId') stageId: string,
    @Body() dto: CreateImplantDto,
    @CurrentUser() user: AuthUser,
  ) {
    const stage = await this.prisma.stageInstance.findUniqueOrThrow({
      where: { id: stageId },
      select: { clinicalCaseId: true },
    });

    const tooth = dto.toothPositionFdi?.trim() || null;
    const label =
      dto.implantLabel?.trim() ||
      (tooth ? `Зуб ${tooth}` : `Имплантат #${dto.implantNumber}`);

    return this.prisma.surgicalImplantRecord.create({
      data: {
        clinicalCaseId: stage.clinicalCaseId,
        stageInstanceId: stageId,
        implantNumber: dto.implantNumber,
        implantLabel: label,
        jawScope: dto.jawScope === JawScope.BOTH ? JawScope.UPPER : dto.jawScope,
        side: dto.side ?? sideFromTooth(tooth),
        toothPositionFdi: tooth,
        implantTypeId: dto.implantTypeId ?? null,
        actualMethodCode: dto.actualMethodCode ?? '',
        createdBy: user.id,
        status: 'DOCUMENTED',
      },
      include: {
        implantType: true,
        radiologyAttachments: { include: { mediaAsset: true } },
      },
    });
  }

  @Post('implants/records/:id/attachments')
  @AuditAction('implant.attachRadiology')
  async attach(
    @Param('id') id: string,
    @Body() dto: AttachRadiologyDto,
    @CurrentUser() user: AuthUser,
  ) {
    const confirmed = dto.surgeonConfirmed !== false;
    return this.prisma.implantRadiologyAttachment.create({
      data: {
        surgicalImplantRecordId: id,
        mediaAssetId: dto.mediaAssetId,
        attachmentType: (dto.attachmentType as never) || 'CT_CROSS_SECTION',
        surgeonConfirmed: confirmed,
        confirmedBy: confirmed ? user.id : null,
        confirmedAt: confirmed ? new Date() : null,
        isRequired: true,
      },
      include: { mediaAsset: true },
    });
  }

  @Get('stages/:stageId/surgeon-confirmation')
  getSurgeonConfirmation(@Param('stageId') stageId: string) {
    return this.prisma.surgeonRadiologyConfirmation.findUnique({
      where: { stageInstanceId: stageId },
    });
  }

  @Post('stages/:stageId/surgeon-confirmation')
  @AuditAction('implant.surgeonConfirm')
  async surgeonConfirm(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmSurgeonDto,
  ) {
    const text = SURGEON_RADIOLOGY_CONFIRMATION_TEXT;
    const snapshotHash = createHash('sha256').update(text + stageId).digest('hex');

    const confirmation = await this.prisma.surgeonRadiologyConfirmation.upsert({
      where: { stageInstanceId: stageId },
      create: {
        stageInstanceId: stageId,
        surgeonUserId: user.id,
        confirmationText: text,
        snapshotHash,
        allImplantsDocumented: dto.allImplantsDocumented,
        optgUploaded: dto.optgUploaded,
        cbctUploaded: dto.cbctUploaded,
        allImplantsHaveCtSlices: dto.allImplantsHaveCtSlices,
        allImplantsHaveMethodSelected: dto.allImplantsHaveMethodSelected,
        hasImplantsForReview: false,
        comment: dto.comment,
      },
      update: {
        surgeonUserId: user.id,
        confirmationText: text,
        snapshotHash,
        ...dto,
        confirmedAt: new Date(),
      },
    });

    await this.prisma.stageInstance.update({
      where: { id: stageId },
      data: { status: 'CONFIRMED' },
    });

    return confirmation;
  }

  @Post('implants/stages/:stageId/surgeon-confirmation')
  @AuditAction('implant.surgeonConfirm.legacy')
  surgeonConfirmLegacy(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmSurgeonDto,
  ) {
    return this.surgeonConfirm(stageId, user, dto);
  }
}

@Module({
  controllers: [ImplantsController],
})
export class ImplantsModule {}
