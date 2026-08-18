import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PatientSex, UserRole, PATIENT_EDITOR_ROLES, isModeratorRole, isExpertRole, maskPatientFio } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { BranchAccessGuard } from '../../common/guards/branch-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditAction, Roles } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class CreatePatientDto {
  /** Номер карты / локальный номер пациента */
  @IsOptional()
  @IsString()
  localPatientNumber?: string;

  /** Alias с UI-формы «Номер карты» */
  @IsOptional()
  @IsString()
  cardNumber?: string;

  @IsString()
  lastName!: string;

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsEnum(PatientSex)
  sex?: PatientSex;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

class UpdatePatientDto {
  @IsOptional()
  @IsString()
  localPatientNumber?: string;

  @IsOptional()
  @IsString()
  cardNumber?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsEnum(PatientSex)
  sex?: PatientSex;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

function mapPatient<T extends { localPatientNumber?: string }>(patient: T, role?: string) {
  const mapped = {
    ...patient,
    cardNumber: patient.localPatientNumber ?? null,
  };
  return isExpertRole(role) ? maskPatientFio(mapped) : mapped;
}

@ApiTags('patients')
@Controller('patients')
@UseGuards(BranchAccessGuard)
export class PatientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @CurrentUser() user: AuthUser,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('q') q?: string,
  ) {
    const term = search ?? q;
    const expert = isExpertRole(user.role);
    const rows = await this.prisma.patient.findMany({
      where: {
        branchId: branchId ?? undefined,
        archivedAt: null,
        OR: term
          ? expert
            ? [{ localPatientNumber: { contains: term, mode: 'insensitive' } }]
            : [
                { lastName: { contains: term, mode: 'insensitive' } },
                { firstName: { contains: term, mode: 'insensitive' } },
                { localPatientNumber: { contains: term, mode: 'insensitive' } },
                { phone: { contains: term, mode: 'insensitive' } },
              ]
          : undefined,
      },
      orderBy: expert
        ? [{ localPatientNumber: 'asc' }]
        : [{ lastName: 'asc' }, { firstName: 'asc' }, { middleName: 'asc' }],
      take: 100,
    });
    return rows.map((row) => mapPatient(row, user.role));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const row = await this.prisma.patient.findUniqueOrThrow({
      where: { id },
      include: { branch: true, cases: true },
    });
    return mapPatient(row, user.role);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...PATIENT_EDITOR_ROLES)
  @AuditAction('patient.create')
  async create(@Body() dto: CreatePatientDto) {
    const localPatientNumber = (dto.localPatientNumber ?? dto.cardNumber ?? '').trim();
    if (!localPatientNumber) {
      throw new BadRequestException('Укажите номер карты пациента');
    }

    const created = await this.prisma.patient.create({
      data: {
        localPatientNumber,
        lastName: dto.lastName.trim(),
        firstName: dto.firstName.trim(),
        middleName: dto.middleName?.trim() || null,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        sex: dto.sex ?? PatientSex.UNSPECIFIED,
        phone: dto.phone?.trim() || null,
        comment: dto.comment?.trim() || null,
        branchId: dto.branchId,
        source: 'LOCAL',
      },
    });
    return mapPatient(created);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...PATIENT_EDITOR_ROLES)
  @AuditAction('patient.update')
  async update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    const localPatientNumber = dto.localPatientNumber ?? dto.cardNumber;
    const updated = await this.prisma.patient.update({
      where: { id },
      data: {
        localPatientNumber: localPatientNumber?.trim() || undefined,
        lastName: dto.lastName?.trim(),
        firstName: dto.firstName?.trim(),
        middleName: dto.middleName === undefined ? undefined : dto.middleName.trim() || null,
        birthDate: dto.birthDate === undefined ? undefined : dto.birthDate ? new Date(dto.birthDate) : null,
        sex: dto.sex,
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
        comment: dto.comment === undefined ? undefined : dto.comment.trim() || null,
      },
    });
    return mapPatient(updated);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR)
  @AuditAction('patient.delete')
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    if (!isModeratorRole(actor.role)) {
      throw new ForbiddenException('Удалять данные может только модератор');
    }
    const patient = await this.prisma.patient.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { cases: true } } },
    });
    if (patient._count.cases > 0) {
      throw new ConflictException(
        'Нельзя удалить карточку пациента: пациент участвует в клиническом случае. Сначала удалите случай.',
      );
    }
    await this.prisma.patient.delete({ where: { id } });
    return { success: true };
  }
}

@Module({ controllers: [PatientsController] })
export class PatientsModule {}
