import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { Client } from '../entities/client.entity';
import { Product } from '../entities/product.entity';
import { CampaignActual } from '../entities/campaign-actual.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MediaPlan,
      MediaPlanRow,
      Client,
      Product,
      CampaignActual,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
