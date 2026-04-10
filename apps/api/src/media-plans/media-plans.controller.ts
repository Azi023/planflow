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
  create(
    @Body() dto: CreatePlanDto,
    @Req() req: { user: { sub: string; email: string } },
  ) {
    return this.mediaPlansService.create(dto, req.user.sub, req.user.email);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlanDto,
    @Req() req: { user: { sub: string; email: string } },
  ) {
    return this.mediaPlansService.update(id, dto, req.user.sub, req.user.email);
  }

  /** Partial update — only updates the fields that are sent (Task 7) */
  @Patch(':id')
  partialUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreatePlanDto>,
    @Req() req: { user: { sub: string; email: string } },
  ) {
    return this.mediaPlansService.partialUpdate(id, dto, req.user.sub, req.user.email);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
    @Req() req: { user: { sub: string; role: string; email: string } },
  ) {
    return this.mediaPlansService.updateStatus(
      id,
      status,
      req.user.role,
      req.user.sub,
      req.user.email,
    );
  }

  @Post(':id/duplicate')
  duplicate(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.mediaPlansService.duplicate(id, req.user.sub);
  }

  @Post(':id/rows/bulk')
  bulkUpsertRows(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
    @Req() req: { user: { sub: string } },
  ) {
    const rows = Array.isArray(body) ? body : body?.rows ?? [];
    return this.mediaPlansService.bulkUpsertRows(id, rows, req.user.sub);
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
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.mediaPlansService.delete(id, req.user.sub);
  }

  // ── Sharing ─────────────────────────────────────────────────

  @Post(':id/share')
  async enableSharing(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('expiresInDays') expiresInDays?: number,
    @Req() req?: { user: { sub: string } },
  ) {
    const result = await this.sharingService.enableSharing(id, expiresInDays);
    this.mediaPlansService.recordShare(id, req?.user?.sub).catch(() => {});
    return result;
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

  // ── Version control ─────────────────────────────────────────

  @Get(':id/versions')
  getVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaPlansService.getVersions(id);
  }

  @Get(':id/versions/diff')
  diffVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('v1') v1: string,
    @Query('v2') v2: string,
  ) {
    return this.mediaPlansService.diffVersions(id, v1, v2);
  }

  @Get(':id/versions/:versionId')
  getVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.mediaPlansService.getVersion(id, versionId);
  }

  @Post(':id/versions/:versionId/restore')
  @Roles('admin', 'planner')
  restoreVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() req: { user: { sub: string } },
  ) {
    return this.mediaPlansService.restoreVersion(id, versionId, req.user.sub);
  }
}
