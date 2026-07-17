import { Module } from '@nestjs/common';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';
import { StageCompletenessApiService } from './stage-completeness-api.service';

@Module({
  controllers: [StagesController],
  providers: [StagesService, StageCompletenessApiService],
  exports: [StagesService, StageCompletenessApiService],
})
export class StagesModule {}
