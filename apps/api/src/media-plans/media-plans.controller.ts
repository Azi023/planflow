import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { MediaPlansService } from './media-plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { MediaPlan } from '../entities/media-plan.entity';

@Controller('media-plans')
export class MediaPlansController {
  constructor(private readonly mediaPlansService: MediaPlansService) {}

  @Get()
  findAll() {
    return this.mediaPlansService.findAll();
  }

  @Get('group/:groupId')
  findByGroup(@Param('groupId') groupId: string): Promise<MediaPlan[]> {
    return this.mediaPlansService.findByGroup(groupId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaPlansService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.mediaPlansService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePlanDto) {
    return this.mediaPlansService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaPlansService.delete(id);
  }
}
