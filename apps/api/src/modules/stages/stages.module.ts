import { Module } from '@nestjs/common';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';
import { StageCompletenessApiService } from './stage-completeness-api.service';
import { StageTemplateSyncService } from './stage-template-sync.service';

@Module({
  controllers: [StagesController],
  providers: [StagesService, StageCompletenessApiService, StageTemplateSyncService],
  exports: [StagesService, StageCompletenessApiService, StageTemplateSyncService],
})
export class StagesModule {}
