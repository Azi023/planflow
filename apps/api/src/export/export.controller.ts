import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';

@Controller('media-plans')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get(':id/export/excel')
  async exportExcel(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.exportExcel(id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id/export/pptx')
  async exportPptx(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.exportPptx(id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id/export/pdf')
  async exportPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.exportPdf(id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

}
