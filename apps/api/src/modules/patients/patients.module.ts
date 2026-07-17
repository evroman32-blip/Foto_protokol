import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PatientSex } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { BranchAccessGuard } from '../../common/guards/branch-access.guard';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { Module } from '@nestjs/common';

class CreatePatientDto {
  @IsString()
  localPatientNumber!: string;

  @IsString()
  lastName!: string;

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsEnum(PatientSex)
  sex?: PatientSex;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

class UpdatePatientDto {
  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

@ApiTags('patients')
@Controller('patients')
@UseGuards(BranchAccessGuard)
export class PatientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Query('branchId') branchId?: string, @Query('search') search?: string) {
    return this.prisma.patient.findMany({
      where: {
        branchId: branchId ?? undefined,
        archivedAt: null,
        OR: search
          ? [
              { lastName: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { localPatientNumber: { contains: search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      orderBy: { lastName: 'asc' },
      take: 100,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.patient.findUniqueOrThrow({
      where: { id },
      include: { branch: true, cases: true },
    });
  }

  @Post()
  @AuditAction('patient.create')
  create(@Body() dto: CreatePatientDto) {
    return this.prisma.patient.create({ data: dto });
  }

  @Patch(':id')
  @AuditAction('patient.update')
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto) {
    return this.prisma.patient.update({ where: { id }, data: dto });
  }
}

@Module({ controllers: [PatientsController] })
export class PatientsModule {}
