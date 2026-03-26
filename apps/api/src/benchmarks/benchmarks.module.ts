import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Benchmark } from '../entities/benchmark.entity';
import { BenchmarksController } from './benchmarks.controller';
import { BenchmarksService } from './benchmarks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Benchmark])],
  controllers: [BenchmarksController],
  providers: [BenchmarksService],
  exports: [BenchmarksService],
})
export class BenchmarksModule {}
