import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Benchmark } from './entities/benchmark.entity';
import { Client } from './entities/client.entity';
import { Product } from './entities/product.entity';
import { MediaPlan } from './entities/media-plan.entity';
import { MediaPlanRow } from './entities/media-plan-row.entity';
import { Audience } from './entities/audience.entity';
import { CreativeType } from './entities/creative-type.entity';
import { BenchmarksModule } from './benchmarks/benchmarks.module';
import { ClientsModule } from './clients/clients.module';
import { MediaPlansModule } from './media-plans/media-plans.module';
import { AudiencesModule } from './audiences/audiences.module';
import { CreativeTypesModule } from './creative-types/creative-types.module';
import { DashboardModule } from './dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get('DB_NAME', 'planflow'),
        username: config.get('DB_USER', 'planflow'),
        password: config.get('DB_PASS', 'planflow_dev'),
        entities: [
          Benchmark,
          Client,
          Product,
          MediaPlan,
          MediaPlanRow,
          Audience,
          CreativeType,
        ],
        synchronize: true,
      }),
    }),
    BenchmarksModule,
    ClientsModule,
    MediaPlansModule,
    AudiencesModule,
    CreativeTypesModule,
    DashboardModule,
  ],
})
export class AppModule {}
