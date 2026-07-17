import { Body, Controller, Get, Param, Post, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

class CreateEmergencyDto {
  @IsString()
  reason!: string;

  @IsString()
  clinicalSituation!: string;

  @IsString()
  actionPerformed!: string;

  @IsOptional()
  @IsString()
  missingMaterials?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

@ApiTags('emergency')
@Controller('stages/:stageId/emergency-events')
export class EmergencyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Param('stageId') stageId: string) {
    return this.prisma.emergencyEvent.findMany({
      where: { stageInstanceId: stageId },
      orderBy: { occurredAt: 'desc' },
    });
  }

  @Post()
  @AuditAction('emergency.create')
  create(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateEmergencyDto,
  ) {
    return this.prisma.emergencyEvent.create({
      data: {
        stageInstanceId: stageId,
        createdBy: user.id,
        occurredAt: new Date(),
        reason: dto.reason,
        clinicalSituation: dto.clinicalSituation,
        actionPerformed: dto.actionPerformed,
        missingMaterials: dto.missingMaterials ?? '',
        comment: dto.comment,
      },
    });
  }
}

@Module({ controllers: [EmergencyController] })
export class EmergencyModule {}
