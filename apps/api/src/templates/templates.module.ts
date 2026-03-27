import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanTemplate } from '../entities/plan-template.entity';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlanTemplate, MediaPlan, MediaPlanRow])],
  controllers: [TemplatesController],
  providers: [TemplatesService],
})
export class TemplatesModule {}
