import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { UserRole } from '@mandarin/contracts';
import { PrismaService } from '../../common/services/prisma.service';
import { BranchAccessGuard } from '../../common/guards/branch-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, AuditAction } from '../../common/decorators/metadata.decorators';
import { Module } from '@nestjs/common';

class CreateBranchDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;
}

class UpdateBranchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('branches')
@Controller('branches')
@UseGuards(BranchAccessGuard)
export class BranchesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll(@Query('active') active?: string) {
    return this.prisma.branch.findMany({
      where: active === 'true' ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.branch.findUniqueOrThrow({ where: { id } });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR)
  @AuditAction('branch.create')
  create(@Body() dto: CreateBranchDto) {
    return this.prisma.branch.create({ data: dto });
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR)
  @AuditAction('branch.update')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.prisma.branch.update({ where: { id }, data: dto });
  }
}

@Module({ controllers: [BranchesController] })
export class BranchesModule {}
