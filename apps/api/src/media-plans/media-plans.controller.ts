import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { MediaPlansService } from './media-plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { MediaPlan } from '../entities/media-plan.entity';
import { Roles } from '../auth/roles.decorator';

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

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
    @Req() req: { user: { role: string } },
  ) {
    return this.mediaPlansService.updateStatus(id, status, req.user.role);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaPlansService.delete(id);
  }
}
