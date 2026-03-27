import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Benchmark } from '../entities/benchmark.entity';
import { BenchmarkHistory } from '../entities/benchmark-history.entity';
import { BenchmarkSuggestion } from '../entities/benchmark-suggestion.entity';
import { CampaignActual } from '../entities/campaign-actual.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { BenchmarksController } from './benchmarks.controller';
import { BenchmarksService } from './benchmarks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Benchmark,
      BenchmarkHistory,
      BenchmarkSuggestion,
      CampaignActual,
      MediaPlanRow,
    ]),
  ],
  controllers: [BenchmarksController],
  providers: [BenchmarksService],
  exports: [BenchmarksService],
})
export class BenchmarksModule {}
