import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampaignActual } from '../entities/campaign-actual.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { ActualsController } from './actuals.controller';
import { ActualsService } from './actuals.service';

@Module({
  imports: [TypeOrmModule.forFeature([CampaignActual, MediaPlanRow])],
  controllers: [ActualsController],
  providers: [ActualsService],
  exports: [ActualsService],
})
export class ActualsModule {}
