import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignActual } from '../entities/campaign-actual.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { CreateActualDto } from './dto/create-actual.dto';
import { BulkCreateActualsDto } from './dto/bulk-create-actuals.dto';

export interface ActualsSummary {
  totalImpressions: number;
  totalReach: number;
  totalClicks: number;
  totalEngagements: number;
  totalVideoViews: number;
  totalLeads: number;
  totalLandingPageViews: number;
  totalSpend: number;
  periodCount: number;
  periods: string[];
  avgCpm?: number;
  avgCtr?: number;
  avgCpc?: number;
}

export interface AccuracyScore {
  platform: string;
  objective: string;
  metric: string;
  projectedLow: number;
  projectedHigh: number;
  actual: number;
  withinRange: boolean;
  accuracy: number;
  sampleSize: number;
}

@Injectable()
export class ActualsService {
  constructor(
    @InjectRepository(CampaignActual)
    private readonly actualRepo: Repository<CampaignActual>,
    @InjectRepository(MediaPlanRow)
    private readonly rowRepo: Repository<MediaPlanRow>,
  ) {}

  findByPlan(planId: string): Promise<CampaignActual[]> {
    return this.actualRepo.find({
      where: { planId },
      relations: ['row'],
      order: { periodStart: 'ASC', createdAt: 'ASC' },
    });
  }

  async getSummary(planId: string): Promise<ActualsSummary> {
    const actuals = await this.findByPlan(planId);

    const totals: ActualsSummary = {
      totalImpressions: 0,
      totalReach: 0,
      totalClicks: 0,
      totalEngagements: 0,
      totalVideoViews: 0,
      totalLeads: 0,
      totalLandingPageViews: 0,
      totalSpend: 0,
      periodCount: 0,
      periods: [],
    };

    const periodSet = new Set<string>();
    for (const a of actuals) {
      const key = a.periodLabel ?? a.periodStart?.toISOString() ?? 'unknown';
      periodSet.add(key);

      totals.totalImpressions += Number(a.actualImpressions ?? 0);
      totals.totalReach += Number(a.actualReach ?? 0);
      totals.totalClicks += Number(a.actualClicks ?? 0);
      totals.totalEngagements += Number(a.actualEngagements ?? 0);
      totals.totalVideoViews += Number(a.actualVideoViews ?? 0);
      totals.totalLeads += Number(a.actualLeads ?? 0);
      totals.totalLandingPageViews += Number(a.actualLandingPageViews ?? 0);
      totals.totalSpend += Number(a.actualSpend ?? 0);
    }

    totals.periodCount = periodSet.size;
    totals.periods = [...periodSet];

    if (totals.totalImpressions > 0) {
      totals.avgCpm = (totals.totalSpend / totals.totalImpressions) * 1000;
      if (totals.totalClicks > 0) {
        totals.avgCtr = (totals.totalClicks / totals.totalImpressions) * 100;
      }
    }
    if (totals.totalClicks > 0) {
      totals.avgCpc = totals.totalSpend / totals.totalClicks;
    }

    return totals;
  }

  async findOne(id: string): Promise<CampaignActual> {
    const actual = await this.actualRepo.findOne({
      where: { id },
      relations: ['row'],
    });
    if (!actual) throw new NotFoundException(`Actual ${id} not found`);
    return actual;
  }

  create(dto: CreateActualDto): Promise<CampaignActual> {
    const actual = this.actualRepo.create({
      ...dto,
      periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
      periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
      source: dto.source ?? 'manual',
    });
    return this.actualRepo.save(actual);
  }

  async bulkCreate(dto: BulkCreateActualsDto): Promise<{ created: number }> {
    const rows = dto.entries.map((entry) =>
      this.actualRepo.create({
        planId: dto.planId,
        periodLabel: dto.periodLabel ?? null,
        periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
        rowId: entry.rowId ?? null,
        actualImpressions: entry.actualImpressions ?? null,
        actualReach: entry.actualReach ?? null,
        actualClicks: entry.actualClicks ?? null,
        actualEngagements: entry.actualEngagements ?? null,
        actualVideoViews: entry.actualVideoViews ?? null,
        actualLeads: entry.actualLeads ?? null,
        actualLandingPageViews: entry.actualLandingPageViews ?? null,
        actualSpend: entry.actualSpend ?? null,
        actualCpm: entry.actualCpm ?? null,
        actualCpc: entry.actualCpc ?? null,
        actualCtr: entry.actualCtr ?? null,
        actualFrequency: entry.actualFrequency ?? null,
        notes: entry.notes ?? null,
        source: 'bulk_paste',
      }),
    );
    await this.actualRepo.save(rows);
    return { created: rows.length };
  }

  async update(
    id: string,
    dto: Partial<CreateActualDto>,
  ): Promise<CampaignActual> {
    const existing = await this.findOne(id);
    const merged = this.actualRepo.merge(existing, {
      ...dto,
      periodStart: dto.periodStart
        ? new Date(dto.periodStart)
        : existing.periodStart,
      periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : existing.periodEnd,
    });
    return this.actualRepo.save(merged);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.actualRepo.delete(id);
  }

  async getAccuracyScores(
    platform?: string,
    objective?: string,
  ): Promise<AccuracyScore[]> {
    // Find plan rows matching the filter that also have actuals
    const rowQb = this.rowRepo
      .createQueryBuilder('row')
      .leftJoinAndSelect('row.benchmark', 'bm')
      .where('row.projected_kpis IS NOT NULL');

    if (platform) rowQb.andWhere('row.platform = :platform', { platform });
    if (objective) rowQb.andWhere('row.objective = :objective', { objective });

    const planRows = await rowQb.getMany();

    const scoreMap = new Map<
      string,
      {
        platform: string;
        objective: string;
        metric: string;
        entries: { low: number; high: number; actual: number }[];
      }
    >();

    for (const row of planRows) {
      const actuals = await this.actualRepo.find({ where: { rowId: row.id } });
      if (!actuals.length) continue;

      const kpis = row.projectedKpis as Record<
        string,
        { low?: number; high?: number }
      >;

      const metricPairs: [string, keyof CampaignActual][] = [
        ['impressions', 'actualImpressions'],
        ['reach', 'actualReach'],
        ['clicks', 'actualClicks'],
        ['cpm', 'actualCpm'],
        ['cpc', 'actualCpc'],
      ];

      for (const [metric, actualField] of metricPairs) {
        const proj = kpis?.[metric];
        if (!proj?.low || !proj?.high) continue;

        const totalActual = actuals.reduce(
          (s, a) => s + Number(a[actualField] ?? 0),
          0,
        );
        if (!totalActual) continue;

        const key = `${row.platform}|${row.objective ?? ''}|${metric}`;
        const existing = scoreMap.get(key) ?? {
          platform: row.platform,
          objective: row.objective ?? '',
          metric,
          entries: [],
        };
        existing.entries.push({
          low: proj.low,
          high: proj.high,
          actual: totalActual,
        });
        scoreMap.set(key, existing);
      }
    }

    return [...scoreMap.values()].map(
      ({ platform: p, objective: o, metric, entries }) => {
        const sampleSize = entries.length;
        let totalAccuracy = 0;
        let withinCount = 0;
        let avgLow = 0;
        let avgHigh = 0;
        let avgActual = 0;

        for (const e of entries) {
          avgLow += e.low;
          avgHigh += e.high;
          avgActual += e.actual;
          const withinRange = e.actual >= e.low && e.actual <= e.high;
          if (withinRange) withinCount++;
          totalAccuracy += this.calcAccuracy(e.low, e.high, e.actual);
        }

        return {
          platform: p,
          objective: o,
          metric,
          projectedLow: avgLow / sampleSize,
          projectedHigh: avgHigh / sampleSize,
          actual: avgActual / sampleSize,
          withinRange: withinCount === sampleSize,
          accuracy: Math.round(totalAccuracy / sampleSize),
          sampleSize,
        };
      },
    );
  }

  private calcAccuracy(
    projLow: number,
    projHigh: number,
    actual: number,
  ): number {
    if (actual >= projLow && actual <= projHigh) return 100;
    const midpoint = (projLow + projHigh) / 2;
    const rangeWidth = projHigh - projLow;
    const deviation = Math.abs(actual - midpoint);
    const normalizedDev =
      rangeWidth > 0 ? deviation / rangeWidth : deviation / midpoint;
    return Math.max(0, Math.round(100 * (1 - normalizedDev)));
  }
}
