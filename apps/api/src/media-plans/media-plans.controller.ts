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
  Query,
  Req,
} from '@nestjs/common';
import { MediaPlansService } from './media-plans.service';
import { SharingService } from '../sharing/sharing.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { MediaPlan } from '../entities/media-plan.entity';
import { Roles } from '../auth/roles.decorator';

@Controller('media-plans')
export class MediaPlansController {
  constructor(
    private readonly mediaPlansService: MediaPlansService,
    private readonly sharingService: SharingService,
  ) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('search') search?: string,
  ) {
    return this.mediaPlansService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      status: status || undefined,
      clientId: clientId || undefined,
      search: search || undefined,
    });
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

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaPlansService.duplicate(id);
  }

  @Post(':id/rows/bulk')
  bulkUpsertRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
  ) {
    // Accept both [...] (array) and {rows: [...]} (object) formats
    const rows = Array.isArray(body) ? body : body?.rows ?? [];
    return this.mediaPlansService.bulkUpsertRows(id, rows);
  }

  @Delete(':id/rows/bulk')
  @HttpCode(200)
  bulkDeleteRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('rowIds') rowIds: string[],
  ) {
    return this.mediaPlansService.bulkDeleteRows(id, rowIds);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaPlansService.delete(id);
  }

  @Post(':id/share')
  enableSharing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('expiresInDays') expiresInDays?: number,
  ) {
    return this.sharingService.enableSharing(id, expiresInDays);
  }

  @Delete(':id/share')
  @HttpCode(200)
  disableSharing(@Param('id', ParseUUIDPipe) id: string) {
    return this.sharingService.disableSharing(id);
  }

  @Get(':id/comments')
  getComments(@Param('id', ParseUUIDPipe) id: string) {
    return this.sharingService.getComments(id);
  }

  @Patch(':id/comments/read')
  markCommentsRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.sharingService.markCommentsRead(id);
  }
}
