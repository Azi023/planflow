import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Benchmark } from '../entities/benchmark.entity';
import { UpdateBenchmarkDto } from './dto/update-benchmark.dto';
import { CalculateKpiDto } from './dto/calculate-kpi.dto';

export interface KpiRange {
  low: number | null;
  high: number | null;
}

export interface CalculatedKpis {
  benchmark: Benchmark;
  impressions: KpiRange;
  reach: KpiRange;
  clicks: KpiRange;
  engagements: KpiRange;
  videoViews2s: KpiRange;
  videoViewsTv: KpiRange;
  landingPageViews: KpiRange;
  leads: KpiRange;
  frequency: KpiRange;
  ctr: KpiRange;
}

@Injectable()
export class BenchmarksService {
  constructor(
    @InjectRepository(Benchmark)
    private readonly benchmarkRepo: Repository<Benchmark>,
  ) {}

  findAll(audienceType?: string, objective?: string): Promise<Benchmark[]> {
    const where: Record<string, string> = {};
    if (audienceType) where.audienceType = audienceType;
    if (objective) where.objective = objective;
    return this.benchmarkRepo.find({
      where,
      order: { objective: 'ASC', platform: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Benchmark> {
    const row = await this.benchmarkRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException(`Benchmark ${id} not found`);
    return row;
  }

  async update(id: string, dto: UpdateBenchmarkDto): Promise<Benchmark> {
    const row = await this.findOne(id);
    return this.benchmarkRepo.save({ ...row, ...dto });
  }

  async calculate(dto: CalculateKpiDto): Promise<CalculatedKpis> {
    const benchmark = await this.benchmarkRepo.findOne({
      where: {
        audienceType: dto.audienceType,
        objective: dto.objective,
        platform: dto.platform,
      },
    });
    if (!benchmark) {
      throw new NotFoundException(
        `No benchmark for platform=${dto.platform}, objective=${dto.objective}, audienceType=${dto.audienceType}`,
      );
    }
    return this.computeKpis(benchmark, dto.budget);
  }

  async importCsv(
    csvContent: string,
  ): Promise<{ imported: number; updated: number }> {
    const lines = csvContent
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return { imported: 0, updated: 0 };

    const headers = lines[0].split(',').map((h) => h.trim());
    let imported = 0;
    let updated = 0;

    const numOrNull = (v: string): number | null => {
      if (!v || v === '') return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    for (const line of lines.slice(1)) {
      const cols = line.split(',');
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i]?.trim() ?? '';
      });

      if (!row.audience_type || !row.objective || !row.platform) continue;

      const existing = await this.benchmarkRepo.findOne({
        where: {
          audienceType: row.audience_type,
          objective: row.objective,
          platform: row.platform,
        },
      });

      const data = {
        audienceType: row.audience_type,
        objective: row.objective,
        platform: row.platform,
        cpmLow: numOrNull(row.cpm_low),
        cpmHigh: numOrNull(row.cpm_high),
        cprLow: numOrNull(row.cpr_low),
        cprHigh: numOrNull(row.cpr_high),
        cpeLow: numOrNull(row.cpe_low),
        cpeHigh: numOrNull(row.cpe_high),
        cpcLow: numOrNull(row.cpc_low),
        cpcHigh: numOrNull(row.cpc_high),
        ctrLow: numOrNull(row.ctr_low),
        ctrHigh: numOrNull(row.ctr_high),
        cpv2sLow: numOrNull(row.cpv_2s_low),
        cpv2sHigh: numOrNull(row.cpv_2s_high),
        cpvTvLow: numOrNull(row.cpv_tv_low),
        cpvTvHigh: numOrNull(row.cpv_tv_high),
        cplvLow: numOrNull(row.cplv_low),
        cplvHigh: numOrNull(row.cplv_high),
        cplLow: numOrNull(row.cpl_low),
        cplHigh: numOrNull(row.cpl_high),
        pageLikeLow: numOrNull(row.page_like_low),
        pageLikeHigh: numOrNull(row.page_like_high),
        currency: row.currency || 'LKR',
        minDuration: row.min_duration || null,
        minDailyBudget: row.min_daily_budget || null,
        frequency: row.frequency || null,
      };

      if (existing) {
        await this.benchmarkRepo.save({ ...existing, ...data });
        updated++;
      } else {
        await this.benchmarkRepo.save(this.benchmarkRepo.create(data));
        imported++;
      }
    }

    return { imported, updated };
  }

  computeKpis(b: Benchmark, budget: number): CalculatedKpis {
    const benchmark = b;
    const n = (v: number | null | string) => (v == null ? null : Number(v));

    const divRange = (
      budgetVal: number,
      low: number | null,
      high: number | null,
      multiplier = 1,
    ): KpiRange => {
      // Estimate missing bounds: if only one side exists, derive the other at ±50%
      const effectiveLow = low ?? (high != null ? high / 1.5 : null);
      const effectiveHigh = high ?? (low != null ? low * 1.5 : null);
      return {
        low: effectiveHigh ? (budgetVal / effectiveHigh) * multiplier : null,
        high: effectiveLow ? (budgetVal / effectiveLow) * multiplier : null,
      };
    };

    const impressions = divRange(budget, n(b.cpmLow), n(b.cpmHigh), 1000);
    const reach = divRange(budget, n(b.cprLow), n(b.cprHigh), 1000);
    const clicks = divRange(budget, n(b.cpcLow), n(b.cpcHigh));
    const engagements = divRange(budget, n(b.cpeLow), n(b.cpeHigh));
    const videoViews2s = divRange(budget, n(b.cpv2sLow), n(b.cpv2sHigh));
    const videoViewsTv = divRange(budget, n(b.cpvTvLow), n(b.cpvTvHigh));
    const landingPageViews = divRange(budget, n(b.cplvLow), n(b.cplvHigh));
    const leads = divRange(budget, n(b.cplLow), n(b.cplHigh));

    const frequency: KpiRange = {
      low:
        impressions.low && reach.high && reach.high > 0
          ? impressions.low / reach.high
          : null,
      high:
        impressions.high && reach.low && reach.low > 0
          ? impressions.high / reach.low
          : null,
    };

    const ctr: KpiRange = {
      low:
        clicks.low && impressions.high && impressions.high > 0
          ? (clicks.low / impressions.high) * 100
          : null,
      high:
        clicks.high && impressions.low && impressions.low > 0
          ? (clicks.high / impressions.low) * 100
          : null,
    };

    return {
      benchmark,
      impressions,
      reach,
      clicks,
      engagements,
      videoViews2s,
      videoViewsTv,
      landingPageViews,
      leads,
      frequency,
      ctr,
    };
  }
}
