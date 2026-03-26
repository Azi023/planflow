import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Audience } from '../entities/audience.entity';
import { AudiencesService } from './audiences.service';
import { AudiencesController } from './audiences.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Audience])],
  controllers: [AudiencesController],
  providers: [AudiencesService],
})
export class AudiencesModule {}
