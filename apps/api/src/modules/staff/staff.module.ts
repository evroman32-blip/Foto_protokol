import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { UserRole } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { BranchAccessGuard } from '../../common/guards/branch-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, AuditAction } from '../../common/decorators/metadata.decorators';
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

  @IsString()
  position!: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
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
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('staff')
@Controller('staff')
@UseGuards(BranchAccessGuard)
export class StaffController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Query('branchId') branchId?: string, @Query('active') active?: string) {
    return this.prisma.staffMember.findMany({
      where: {
        branchId: branchId ?? undefined,
        isActive: active === 'false' ? undefined : true,
      },
      include: { branch: true, user: { select: { id: true, email: true, role: true } } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.staffMember.findUniqueOrThrow({
      where: { id },
      include: { branch: true, user: true },
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.ORTHOPEDIC_MANAGER, UserRole.CHIEF_DOCTOR)
  @AuditAction('staff.create')
  async create(@Body() dto: CreateStaffDto) {
    const staff = await this.prisma.staffMember.create({
      data: {
        lastName: dto.lastName,
        firstName: dto.firstName,
        middleName: dto.middleName,
        position: dto.position,
        specialization: dto.specialization,
        branchId: dto.branchId,
      },
    });

    if (dto.email && dto.role) {
      const passwordHash = await bcrypt.hash('ChangeMe123!', 10);
      await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          role: dto.role,
          requestedRole: dto.role,
          accountStatus: 'APPROVED',
          staffMemberId: staff.id,
        },
      });
    }

    return this.prisma.staffMember.findUniqueOrThrow({
      where: { id: staff.id },
      include: { branch: true, user: true },
    });
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.ORTHOPEDIC_MANAGER, UserRole.CHIEF_DOCTOR)
  @AuditAction('staff.update')
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.prisma.staffMember.update({
      where: { id },
      data: dto,
      include: { branch: true, user: true },
    });
  }
}

@Module({ controllers: [StaffController] })
export class StaffModule {}
