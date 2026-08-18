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
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { StaffClinicalRole, UserRole, SPECIALIZATIONS, ACCEPTED_JOB_TITLES, STAFF_PATIENT_EDITOR_ROLES, isModeratorRole } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { BranchAccessGuard } from '../../common/guards/branch-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Module } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

class CreateStaffDto {
  @IsString()
  lastName!: string;

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsIn([...ACCEPTED_JOB_TITLES, 'Эксперт'], { message: 'Выберите должность из списка' })
  position!: string;

  @IsOptional()
  @IsIn([...SPECIALIZATIONS], { message: 'Выберите специализацию из списка' })
  specialization?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(StaffClinicalRole, { each: true })
  clinicalRoles?: StaffClinicalRole[];

  @IsOptional()
  @IsArray()
  @IsEnum(StaffClinicalRole, { each: true })
  roles?: StaffClinicalRole[];

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserRole)
  userRole?: UserRole;
}

class UpdateStaffDto {
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
  position?: string;

  @IsOptional()
  @IsIn([...SPECIALIZATIONS], { message: 'Выберите специализацию из списка' })
  specialization?: string | null;

  @IsOptional()
  @IsArray()
  @IsEnum(StaffClinicalRole, { each: true })
  clinicalRoles?: StaffClinicalRole[];

  @IsOptional()
  @IsArray()
  @IsEnum(StaffClinicalRole, { each: true })
  roles?: StaffClinicalRole[];

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(UserRole)
  userRole?: UserRole;
}

function mapStaff<T extends { clinicalRoles?: string[] }>(row: T) {
  const clinicalRoles = row.clinicalRoles ?? [];
  return {
    ...row,
    clinicalRoles,
    roles: clinicalRoles,
  };
}

@ApiTags('staff')
@Controller('staff')
@UseGuards(BranchAccessGuard)
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('active') active?: string,
    @Query('q') q?: string,
  ) {
    const term = q?.trim();
    const rows = await this.prisma.staffMember.findMany({
      where: {
        branchId: branchId ?? undefined,
        isActive: active === 'false' ? undefined : true,
        OR: term
          ? [
              { lastName: { contains: term, mode: 'insensitive' } },
              { firstName: { contains: term, mode: 'insensitive' } },
              { middleName: { contains: term, mode: 'insensitive' } },
              { position: { contains: term, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { branch: true, user: { select: { id: true, email: true, role: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { middleName: 'asc' }],
    });
    return rows.map(mapStaff);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const row = await this.prisma.staffMember.findUniqueOrThrow({
      where: { id },
      include: { branch: true, user: true },
    });
    return mapStaff(row);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...STAFF_PATIENT_EDITOR_ROLES)
  @AuditAction('staff.create')
  async create(@Body() dto: CreateStaffDto, @CurrentUser() actor: AuthUser) {
    const clinicalRoles = dto.clinicalRoles ?? dto.roles ?? [];
    const staff = await this.prisma.staffMember.create({
      data: {
        lastName: dto.lastName,
        firstName: dto.firstName,
        middleName: dto.middleName,
        position: dto.position,
        specialization: dto.specialization,
        clinicalRoles,
        branchId: dto.branchId,
      },
    });

    const accountRole = dto.userRole ?? dto.role;
    if (dto.email && accountRole) {
      if (!isModeratorRole(actor.role)) {
        throw new ForbiddenException('Назначать роль аккаунта может только модератор');
      }
      const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
      await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: accountRole,
          requestedRole: accountRole,
          accountStatus: 'APPROVED',
          staffMemberId: staff.id,
        },
      });
    }

    const created = await this.prisma.staffMember.findUniqueOrThrow({
      where: { id: staff.id },
      include: { branch: true, user: true },
    });
    return mapStaff(created);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(...STAFF_PATIENT_EDITOR_ROLES)
  @AuditAction('staff.update')
  async update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @CurrentUser() actor: AuthUser) {
    const clinicalRoles = dto.clinicalRoles ?? dto.roles;
    const staff = await this.prisma.staffMember.update({
      where: { id },
      data: {
        lastName: dto.lastName,
        firstName: dto.firstName,
        middleName: dto.middleName,
        position: dto.position,
        specialization: dto.specialization === undefined ? undefined : dto.specialization,
        branchId: dto.branchId,
        isActive: dto.isActive,
        ...(clinicalRoles ? { clinicalRoles } : {}),
      },
      include: { user: true, branch: true },
    });

    if (dto.userRole && staff.user) {
      if (!isModeratorRole(actor.role)) {
        throw new ForbiddenException('Назначать роль аккаунта может только модератор');
      }
      await this.prisma.user.update({
        where: { id: staff.user.id },
        data: { role: dto.userRole },
      });
    }

    const updated = await this.prisma.staffMember.findUniqueOrThrow({
      where: { id },
      include: { branch: true, user: true },
    });
    return mapStaff(updated);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR)
  @AuditAction('staff.delete')
  async remove(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    if (!isModeratorRole(actor.role)) {
      throw new ForbiddenException('Удалять данные может только модератор');
    }
    const staff = await this.prisma.staffMember.findUniqueOrThrow({
      where: { id },
      include: { user: true, _count: { select: { participations: true } } },
    });
    if (staff.user?.id === actor.id) {
      throw new ForbiddenException('Нельзя удалить собственную карточку');
    }
    if (staff._count.participations > 0) {
      throw new ConflictException(
        'Нельзя удалить карточку сотрудника: сотрудник участвует в клиническом случае. Сначала удалите случай.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      if (staff.user) {
        await tx.user.delete({ where: { id: staff.user.id } });
      }
      await tx.staffMember.delete({ where: { id } });
    });
    return { success: true };
  }
}

@Module({ controllers: [StaffController] })
export class StaffModule {}
