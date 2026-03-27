import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ActualsService } from './actuals.service';
import { CreateActualDto } from './dto/create-actual.dto';
import { BulkCreateActualsDto } from './dto/bulk-create-actuals.dto';

@Controller('actuals')
export class ActualsController {
  constructor(private readonly actualsService: ActualsService) {}

  @Get('plan/:planId')
  findByPlan(@Param('planId') planId: string) {
    return this.actualsService.findByPlan(planId);
  }

  @Get('plan/:planId/summary')
  getSummary(@Param('planId') planId: string) {
    return this.actualsService.getSummary(planId);
  }

  @Get('accuracy')
  getAccuracy(
    @Query('platform') platform?: string,
    @Query('objective') objective?: string,
  ) {
    return this.actualsService.getAccuracyScores(platform, objective);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.actualsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateActualDto) {
    return this.actualsService.create(dto);
  }

  @Post('bulk')
  bulkCreate(@Body() dto: BulkCreateActualsDto) {
    return this.actualsService.bulkCreate(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateActualDto>) {
    return this.actualsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.actualsService.remove(id);
  }
}
