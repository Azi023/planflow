import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanTemplate } from '../entities/plan-template.entity';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { Benchmark } from '../entities/benchmark.entity';
import { BenchmarksModule } from '../benchmarks/benchmarks.module';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanTemplate,
      MediaPlan,
      MediaPlanRow,
      Benchmark,
    ]),
    BenchmarksModule,
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService],
})
export class TemplatesModule {}
