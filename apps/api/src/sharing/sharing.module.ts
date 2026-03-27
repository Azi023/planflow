import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaPlan } from '../entities/media-plan.entity';
import { PlanComment } from '../entities/plan-comment.entity';
import { SharingService } from './sharing.service';
import { SharedPlanController } from './shared-plan.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MediaPlan, PlanComment])],
  controllers: [SharedPlanController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
