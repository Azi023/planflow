import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { Benchmark } from '../entities/benchmark.entity';
import { PlanVersion } from '../entities/plan-version.entity';
import { BenchmarksModule } from '../benchmarks/benchmarks.module';
import { SharingModule } from '../sharing/sharing.module';
import { MediaPlansController } from './media-plans.controller';
import { MediaPlansService } from './media-plans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MediaPlan, MediaPlanRow, Benchmark, PlanVersion]),
    BenchmarksModule,
    SharingModule,
  ],
  controllers: [MediaPlansController],
  providers: [MediaPlansService],
  exports: [MediaPlansService],
})
export class MediaPlansModule {}
