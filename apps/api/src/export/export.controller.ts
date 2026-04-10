import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { AuditService } from '../audit/audit.service';

@Controller('media-plans')
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly auditService: AuditService,
  ) {}

  @Get(':id/export/excel')
  async exportExcel(
    @Param('id') id: string,
    @Res() res: Response,
    @Req() req: { user?: { sub?: string; email?: string } },
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.exportExcel(id);
    this.auditService.log(
      'plan.exported',
      'media_plan',
      id,
      req.user?.sub ?? null,
      { format: 'excel' },
      undefined,
      req.user?.email,
    );
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
    @Req() req: { user?: { sub?: string; email?: string } },
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.exportPptx(id);
    this.auditService.log(
      'plan.exported',
      'media_plan',
      id,
      req.user?.sub ?? null,
      { format: 'pptx' },
      undefined,
      req.user?.email,
    );
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
    @Req() req: { user?: { sub?: string; email?: string } },
  ): Promise<void> {
    const { buffer, filename } = await this.exportService.exportPdf(id);
    this.auditService.log(
      'plan.exported',
      'media_plan',
      id,
      req.user?.sub ?? null,
      { format: 'pdf' },
      undefined,
      req.user?.email,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
