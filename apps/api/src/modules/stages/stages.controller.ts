import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
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
