import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Benchmark } from './entities/benchmark.entity';
import { Client } from './entities/client.entity';
import { Product } from './entities/product.entity';
import { MediaPlan } from './entities/media-plan.entity';
import { MediaPlanRow } from './entities/media-plan-row.entity';
import { Audience } from './entities/audience.entity';
import { CreativeType } from './entities/creative-type.entity';
import { User } from './entities/user.entity';
import { BenchmarksModule } from './benchmarks/benchmarks.module';
import { ClientsModule } from './clients/clients.module';
import { MediaPlansModule } from './media-plans/media-plans.module';
import { AudiencesModule } from './audiences/audiences.module';
import { CreativeTypesModule } from './creative-types/creative-types.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { ExportModule } from './export/export.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

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
          User,
        ],
        synchronize: true,
      }),
    }),
    AuthModule,
    BenchmarksModule,
    ClientsModule,
    MediaPlansModule,
    AudiencesModule,
    CreativeTypesModule,
    DashboardModule,
    ExportModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
