import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BenchmarksService } from './benchmarks.service';
import { UpdateBenchmarkDto } from './dto/update-benchmark.dto';
import { CalculateKpiDto } from './dto/calculate-kpi.dto';
import { Roles } from '../auth/roles.decorator';
import { Request } from 'express';

interface AuthRequest extends Request {
  user?: { id?: string; name?: string };
}

@Controller('benchmarks')
export class BenchmarksController {
  constructor(private readonly benchmarksService: BenchmarksService) {}

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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBenchmarkDto,
    @Req() req: AuthRequest,
  ) {
    const changedBy = req.user?.name ?? req.user?.id ?? null;
    return this.benchmarksService.update(id, dto, changedBy ?? undefined, 'manual');
  }

  @Post('calculate')
  calculate(@Body() dto: CalculateKpiDto) {
    return this.benchmarksService.calculate(dto);
  }

  @Post('import')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@UploadedFile() file: Express.Multer.File) {
    return this.benchmarksService.importCsv(file.buffer.toString('utf-8'));
  }
}
