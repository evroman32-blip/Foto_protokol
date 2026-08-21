import { Body, Controller, Delete, Get, Param, Patch, Post, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ImpressionCaptureMode } from '@mandarin/contracts';
import { AuditAction } from '../../common/decorators/metadata.decorators';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { StagesService } from './stages.service';

class ConfirmStageDto {
  @IsOptional()
  @IsString()
  confirmationText?: string;
}

class CloseStageDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

class ReopenStageDto {
  @IsString({ message: 'Укажите причину переоткрытия' })
  reason!: string;
}

class UpdateImpressionModeDto {
  @IsEnum(ImpressionCaptureMode, { message: 'Укажите SCAN или IMPRESSION' })
  impressionCaptureMode!: ImpressionCaptureMode;
}

class UpdateMediaBranchModeDto {
  @IsString({ message: 'Укажите вид информации' })
  mediaBranchMode!: string;
}

const TOOTH_SHADES = ['BL1', 'BL2', 'BL3', 'BL4', 'B1', 'A1', 'A2', 'A3', 'A4'] as const;

class UpdateDesiredToothShadeDto {
  @IsString({ message: 'Укажите цвет зубов' })
  desiredToothShade!: string;
}

@ApiTags('stages')
@Controller('stages')
export class StagesController {
  constructor(private readonly stagesService: StagesService) {}

  @Get(':stageId')
  @ApiOperation({ summary: 'Получить этап' })
  findOne(@Param('stageId') stageId: string) {
    return this.stagesService.findOne(stageId);
  }

  @Get(':stageId/completeness')
  @ApiOperation({ summary: 'Проверка полноты этапа' })
  completeness(@Param('stageId') stageId: string) {
    return this.stagesService.getCompleteness(stageId);
  }

  @Patch(':stageId/impression-capture-mode')
  @AuditAction('stage.impression_capture_mode')
  @ApiOperation({ summary: 'Выбор скан или оттиск на этапе IMPRESSIONS_OR_SCANS' })
  setImpressionCaptureMode(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateImpressionModeDto,
  ) {
    return this.stagesService.setImpressionCaptureMode(
      stageId,
      user,
      dto.impressionCaptureMode,
    );
  }

  @Patch(':stageId/media-branch-mode')
  @AuditAction('stage.media_branch_mode')
  @ApiOperation({ summary: 'Выбор вида информации для закрытия смешанного этапа' })
  setMediaBranchMode(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMediaBranchModeDto,
  ) {
    return this.stagesService.setMediaBranchMode(stageId, user, dto.mediaBranchMode);
  }

  @Patch(':stageId/desired-tooth-shade')
  @AuditAction('stage.desired_tooth_shade')
  @ApiOperation({ summary: 'Желаемый цвет зубов на этапе JAW_RELATION' })
  setDesiredToothShade(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateDesiredToothShadeDto,
  ) {
    const shade = String(dto.desiredToothShade ?? '')
      .trim()
      .toUpperCase();
    if (!(TOOTH_SHADES as readonly string[]).includes(shade)) {
      throw new BadRequestException(
        `Допустимые значения: ${TOOTH_SHADES.join(', ')}`,
      );
    }
    return this.stagesService.setDesiredToothShade(stageId, user, shade);
  }

  @Delete(':stageId/requirement-instances/:requirementInstanceId')
  @AuditAction('stage.requirement.remove')
  @ApiOperation({ summary: 'Удалить положение из этапа (только модератор)' })
  removeRequirementInstance(
    @Param('stageId') stageId: string,
    @Param('requirementInstanceId') requirementInstanceId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stagesService.removeRequirementInstance(stageId, requirementInstanceId, user);
  }

  @Post(':stageId/confirm')
  @AuditAction('stage.confirm')
  @ApiOperation({ summary: 'Подтверждение этапа врачом' })
  confirm(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmStageDto,
  ) {
    return this.stagesService.confirm(stageId, user, dto.confirmationText);
  }

  @Post(':stageId/close')
  @AuditAction('stage.close')
  @ApiOperation({ summary: 'Закрытие этапа' })
  close(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CloseStageDto,
  ) {
    return this.stagesService.close(stageId, user, dto.comment);
  }

  @Post(':stageId/reopen')
  @AuditAction('stage.reopen')
  @ApiOperation({ summary: 'Переоткрытие этапа' })
  reopen(
    @Param('stageId') stageId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ReopenStageDto,
  ) {
    return this.stagesService.reopen(stageId, user, dto.reason);
  }
}
