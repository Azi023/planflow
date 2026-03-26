import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreativeType } from '../entities/creative-type.entity';
import { CreativeTypesService } from './creative-types.service';
import { CreativeTypesController } from './creative-types.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CreativeType])],
  controllers: [CreativeTypesController],
  providers: [CreativeTypesService],
})
export class CreativeTypesModule {}
