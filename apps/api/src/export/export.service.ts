import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MediaPlan } from '../entities/media-plan.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { buildExcelBuffer } from './templates/excel-template';
import { buildPptxBuffer } from './templates/pptx-template';

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(MediaPlan)
    private readonly planRepo: Repository<MediaPlan>,
    @InjectRepository(MediaPlanRow)
    private readonly rowRepo: Repository<MediaPlanRow>,
  ) {}

  private async loadPlan(id: string): Promise<{ plan: MediaPlan; rows: MediaPlanRow[] }> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: ['client', 'product'],
    });
    if (!plan) throw new NotFoundException(`Plan ${id} not found`);

    const rows = await this.rowRepo.find({
      where: { planId: id },
      order: { sortOrder: 'ASC' },
    });

    return { plan, rows };
  }

  async exportExcel(planId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { plan, rows } = await this.loadPlan(planId);
    const buffer = await buildExcelBuffer(plan, rows);
    const safe = (plan.campaignName ?? 'media-plan').replace(/[^a-zA-Z0-9-_]/g, '_');
    return { buffer, filename: `${safe}.xlsx` };
  }

  async exportPptx(planId: string): Promise<{ buffer: Buffer; filename: string }> {
    const { plan, rows } = await this.loadPlan(planId);
    const buffer = await buildPptxBuffer(plan, rows);
    const safe = (plan.campaignName ?? 'media-plan').replace(/[^a-zA-Z0-9-_]/g, '_');
    return { buffer, filename: `${safe}.pptx` };
  }
}
