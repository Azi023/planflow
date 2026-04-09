import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { BenchmarksService } from './benchmarks.service';
import { AuditService } from '../audit/audit.service';
import { UpdateBenchmarkDto } from './dto/update-benchmark.dto';
import { CalculateKpiDto } from './dto/calculate-kpi.dto';
import { Roles } from '../auth/roles.decorator';
import { Request } from 'express';

interface AuthRequest extends Request {
  user?: { id?: string; name?: string };
}

@Controller('benchmarks')
export class BenchmarksController {
  constructor(
    private readonly benchmarksService: BenchmarksService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  findAll(
    @Query('audienceType') audienceType?: string,
    @Query('objective') objective?: string,
  ) {
    return this.benchmarksService.findAll(audienceType, objective);
  }

  @Get('confidence')
  getConfidenceLevels() {
    return this.benchmarksService.getConfidenceLevels();
  }

  @Get('suggestions')
  getSuggestions(@Query('benchmarkId') benchmarkId?: string) {
    return this.benchmarksService.getSuggestions(benchmarkId);
  }

  @Post('suggestions/compute')
  @Roles('admin')
  computeSuggestions() {
    return this.benchmarksService.computeAndSaveSuggestions();
  }

  @Post('suggestions/:id/accept')
  @Roles('admin')
  acceptSuggestion(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthRequest,
  ) {
    const changedBy = req.user?.name ?? req.user?.id ?? 'admin';
    return this.benchmarksService.acceptSuggestion(id, changedBy);
  }

  @Post('suggestions/:id/reject')
  @Roles('admin')
  rejectSuggestion(@Param('id', ParseUUIDPipe) id: string) {
    return this.benchmarksService.rejectSuggestion(id);
  }

  @Get('export')
  async exportCsv(
    @Query('audienceType') audienceType: string,
    @Res() res: Response,
  ) {
    const csv = await this.benchmarksService.exportCsv(audienceType);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="benchmarks_${audienceType || 'all'}.csv"`,
    });
    res.send(csv);
  }

  @Get(':id/history')
  getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.benchmarksService.getHistory(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.benchmarksService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBenchmarkDto,
    @Req() req: AuthRequest,
  ) {
    const changedBy = req.user?.name ?? req.user?.id ?? null;
    const result = await this.benchmarksService.update(
      id,
      dto,
      changedBy ?? undefined,
      'manual',
    );
    this.auditService.log(
      'benchmark.updated',
      'benchmark',
      id,
      req.user?.id ?? null,
      { changedBy, fields: Object.keys(dto) },
    );
    return result;
  }

  @Post('calculate')
  calculate(@Body() dto: CalculateKpiDto) {
    return this.benchmarksService.calculate(dto);
  }

  @Post('import')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    const result = await this.benchmarksService.importCsv(
      file.buffer.toString('utf-8'),
    );
    this.auditService.log(
      'benchmark.imported',
      'benchmark',
      null,
      req.user?.id ?? null,
      { imported: result.imported, updated: result.updated },
    );
    return result;
  }
}
