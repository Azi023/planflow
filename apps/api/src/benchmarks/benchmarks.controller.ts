import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BenchmarksService } from './benchmarks.service';
import { UpdateBenchmarkDto } from './dto/update-benchmark.dto';
import { CalculateKpiDto } from './dto/calculate-kpi.dto';
import { Roles } from '../auth/roles.decorator';

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

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.benchmarksService.findOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBenchmarkDto,
  ) {
    return this.benchmarksService.update(id, dto);
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
