import { Body, Controller, Get, Param, Patch, Post, Query, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CaseStatus, JawScope, ParticipantRole } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Module } from '@nestjs/common';

class ParticipantDto {
  @IsUUID()
  staffMemberId!: string;

  @IsEnum(ParticipantRole)
  participantRole!: ParticipantRole;

  @IsOptional()
  isPrimary?: boolean;
}

class CreateCaseDto {
  @IsUUID()
  patientId!: string;

  @IsUUID()
  protocolVersionId!: string;

  @IsEnum(JawScope)
  jawScope!: JawScope;

  @IsDateString()
  treatmentStartDate!: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  clinicalScenario!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants!: ParticipantDto[];
}

class UpdateCaseDto {
  @IsOptional()
  @IsEnum(CaseStatus)
  status?: CaseStatus;

  @IsOptional()
  clinicalScenario?: string;

  @IsOptional()
  @IsEnum(JawScope)
  jawScope?: JawScope;

  @IsOptional()
  @IsDateString()
  treatmentStartDate?: string;
}

const REQUIRED_ROLES: ParticipantRole[] = [
  ParticipantRole.CONSULTING_DOCTOR,
  ParticipantRole.ORTHOPEDIST,
  ParticipantRole.SURGEON,
  ParticipantRole.DENTAL_TECHNICIAN,
];

function assertFourPrimaryParticipants(participants: ParticipantDto[]) {
  for (const role of REQUIRED_ROLES) {
    const primary = participants.find((p) => p.participantRole === role && p.isPrimary !== false);
    if (!primary) {
      throw new BadRequestException(`Требуется primary участник с ролью ${role}`);
    }
  }
}

@ApiTags('cases')
@Controller('cases')
export class CasesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Query('patientId') patientId?: string, @Query('status') status?: CaseStatus) {
    return this.prisma.clinicalCase.findMany({
      where: {
        patientId: patientId ?? undefined,
        status: status ?? undefined,
      },
      include: {
        patient: true,
        protocolVersion: { include: { protocol: true } },
        participants: { include: { staffMember: true } },
        stages: { include: { stageTemplate: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.clinicalCase.findUniqueOrThrow({
      where: { id },
      include: {
        patient: true,
        participants: { include: { staffMember: true } },
        stages: { include: { stageTemplate: true } },
        protocolVersion: { include: { protocol: true } },
      },
    });
  }

  @Get(':id/stages')
  listStages(@Param('id') id: string) {
    return this.prisma.stageInstance.findMany({
      where: { clinicalCaseId: id },
      include: { stageTemplate: true },
      orderBy: { stageTemplate: { sortOrder: 'asc' } },
    });
  }

  @Post()
  @AuditAction('case.create')
  async create(@Body() dto: CreateCaseDto, @CurrentUser() user: AuthUser) {
    assertFourPrimaryParticipants(dto.participants);

    const templates = await this.prisma.stageTemplate.findMany({
      where: { protocolVersionId: dto.protocolVersionId, isActive: true },
      include: { mediaRequirements: true },
      orderBy: { sortOrder: 'asc' },
    });

    return this.prisma.clinicalCase.create({
      data: {
        patientId: dto.patientId,
        protocolVersionId: dto.protocolVersionId,
        jawScope: dto.jawScope,
        treatmentStartDate: new Date(dto.treatmentStartDate),
        branchId: dto.branchId,
        clinicalScenario: dto.clinicalScenario,
        status: CaseStatus.ACTIVE,
        createdBy: user.id,
        participants: {
          create: dto.participants.map((p) => ({
            staffMemberId: p.staffMemberId,
            participantRole: p.participantRole,
            isPrimary: p.isPrimary ?? true,
            assignedBy: user.id,
          })),
        },
        stages: {
          create: templates.map((t) => ({
            stageTemplateId: t.id,
            protocolVersionId: dto.protocolVersionId,
            status: 'NOT_STARTED',
            requirementInstances: {
              create: t.mediaRequirements.map((req) => ({
                mediaRequirementId: req.id,
              })),
            },
          })),
        },
      },
      include: {
        participants: { include: { staffMember: true } },
        stages: { include: { stageTemplate: true } },
      },
    });
  }

  @Patch(':id')
  @AuditAction('case.update')
  update(@Param('id') id: string, @Body() dto: UpdateCaseDto) {
    return this.prisma.clinicalCase.update({
      where: { id },
      data: {
        status: dto.status,
        clinicalScenario: dto.clinicalScenario,
        jawScope: dto.jawScope,
        treatmentStartDate: dto.treatmentStartDate ? new Date(dto.treatmentStartDate) : undefined,
      },
      include: {
        patient: true,
        participants: { include: { staffMember: true } },
        stages: { include: { stageTemplate: true } },
      },
    });
  }

  @Post(':id/participants')
  @AuditAction('case.participants.add')
  async addParticipant(
    @Param('id') id: string,
    @Body() dto: ParticipantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.prisma.caseParticipant.create({
      data: {
        clinicalCaseId: id,
        staffMemberId: dto.staffMemberId,
        participantRole: dto.participantRole,
        isPrimary: dto.isPrimary ?? false,
        assignedBy: user.id,
      },
      include: { staffMember: true },
    });
  }

  @Patch(':id/participants/:participantId')
  @AuditAction('case.participants.update')
  updateParticipant(
    @Param('participantId') participantId: string,
    @Body() dto: Partial<ParticipantDto & { removedAt?: string; removalReason?: string }>,
  ) {
    return this.prisma.caseParticipant.update({
      where: { id: participantId },
      data: {
        isPrimary: dto.isPrimary,
        removedAt: dto.removedAt ? new Date(dto.removedAt) : undefined,
        removalReason: dto.removalReason,
      },
      include: { staffMember: true },
    });
  }
}

@Module({ controllers: [CasesController] })
export class CasesModule {}
