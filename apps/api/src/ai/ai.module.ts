import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { Benchmark } from '../entities/benchmark.entity';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Benchmark, MediaPlan, MediaPlanRow]),
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
