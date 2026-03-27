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
import { CampaignActual } from './entities/campaign-actual.entity';
import { PlanTemplate } from './entities/plan-template.entity';
import { PlanComment } from './entities/plan-comment.entity';
import { BenchmarksModule } from './benchmarks/benchmarks.module';
import { ClientsModule } from './clients/clients.module';
import { MediaPlansModule } from './media-plans/media-plans.module';
import { AudiencesModule } from './audiences/audiences.module';
import { CreativeTypesModule } from './creative-types/creative-types.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { ExportModule } from './export/export.module';
import { ActualsModule } from './actuals/actuals.module';
import { TemplatesModule } from './templates/templates.module';
import { SharingModule } from './sharing/sharing.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

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
          CampaignActual,
          PlanTemplate,
          PlanComment,
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
    ActualsModule,
    TemplatesModule,
    SharingModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
