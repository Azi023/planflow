import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Benchmark } from '../entities/benchmark.entity';
import { BenchmarkHistory } from '../entities/benchmark-history.entity';
import { BenchmarkSuggestion } from '../entities/benchmark-suggestion.entity';
import { CampaignActual } from '../entities/campaign-actual.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
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

// Minimum number of actuals required before an auto-tune suggestion is generated.
// Suggestions based on fewer data points would be statistically unreliable.
const MIN_ACTUALS_FOR_SUGGESTION = 15;

// Fields that can be auto-tuned (numeric, nullable)
const TUNABLE_FIELDS: Array<keyof Benchmark> = [
  'cpmLow',
  'cpmHigh',
  'cpcLow',
  'cpcHigh',
  'cprLow',
  'cprHigh',
];

@Injectable()
export class BenchmarksService {
  constructor(
    @InjectRepository(Benchmark)
    private readonly benchmarkRepo: Repository<Benchmark>,
    @InjectRepository(BenchmarkHistory)
    private readonly historyRepo: Repository<BenchmarkHistory>,
    @InjectRepository(BenchmarkSuggestion)
    private readonly suggestionRepo: Repository<BenchmarkSuggestion>,
    @InjectRepository(CampaignActual)
    private readonly actualRepo: Repository<CampaignActual>,
    @InjectRepository(MediaPlanRow)
    private readonly rowRepo: Repository<MediaPlanRow>,
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

  async update(
    id: string,
    dto: UpdateBenchmarkDto,
    changedBy?: string,
    source: 'manual' | 'auto_tune' | 'csv_import' = 'manual',
  ): Promise<Benchmark> {
    const existing = await this.findOne(id);
    await this.logHistory(existing, dto, changedBy ?? null, source);
    return this.benchmarkRepo.save({ ...existing, ...dto });
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
        await this.logHistory(existing, data, null, 'csv_import');
        await this.benchmarkRepo.save({ ...existing, ...data });
        updated++;
      } else {
        await this.benchmarkRepo.save(this.benchmarkRepo.create(data));
        imported++;
      }
    }

    return { imported, updated };
  }

  // ─── History ────────────────────────────────────────────────────────────────

  async getHistory(benchmarkId: string): Promise<BenchmarkHistory[]> {
    return this.historyRepo.find({
      where: { benchmarkId },
      order: { changedAt: 'DESC' },
    });
  }

  private async logHistory(
    existing: Benchmark,
    updates: Partial<Benchmark>,
    changedBy: string | null,
    source: string,
  ): Promise<void> {
    const records: Partial<BenchmarkHistory>[] = [];
    for (const [key, newVal] of Object.entries(updates)) {
      const oldVal = (existing as unknown as Record<string, unknown>)[key];
      const oldStr = oldVal == null ? null : String(oldVal);
      const newStr = newVal == null ? null : String(newVal);
      if (oldStr !== newStr) {
        records.push({
          benchmarkId: existing.id,
          fieldChanged: key,
          oldValue: oldStr,
          newValue: newStr,
          changedBy,
          source,
        });
      }
    }
    if (records.length) {
      await this.historyRepo.save(
        records.map((r) => this.historyRepo.create(r)),
      );
    }
  }

  // ─── Auto-Tuning Suggestions ────────────────────────────────────────────────

  async getSuggestions(benchmarkId?: string): Promise<BenchmarkSuggestion[]> {
    const where: Record<string, unknown> = { status: 'pending' };
    if (benchmarkId) where.benchmarkId = benchmarkId;
    return this.suggestionRepo.find({
      where,
      relations: ['benchmark'],
      order: { createdAt: 'DESC' },
    });
  }

  async computeAndSaveSuggestions(): Promise<{
    created: number;
    skipped: number;
  }> {
    const benchmarks = await this.benchmarkRepo.find();
    let created = 0;
    let skipped = 0;

    for (const b of benchmarks) {
      // Find all plan rows matching this benchmark's platform+objective+audienceType
      const rows = await this.rowRepo.find({
        where: {
          platform: b.platform,
          objective: b.objective,
          audienceType: b.audienceType,
        },
      });
      if (!rows.length) continue;

      const rowIds = rows.map((r) => r.id);
      const actuals = await this.actualRepo
        .createQueryBuilder('a')
        .where('a.row_id IN (:...rowIds)', { rowIds })
        .getMany();

      if (!actuals.length) continue;

      // Compute average actual CPM
      const cpmActuals = actuals.filter(
        (a) => a.actualCpm && Number(a.actualCpm) > 0,
      );
      if (cpmActuals.length >= MIN_ACTUALS_FOR_SUGGESTION) {
        const avgActualCpm =
          cpmActuals.reduce((s, a) => s + Number(a.actualCpm), 0) /
          cpmActuals.length;

        // Compare to benchmark range midpoint
        if (b.cpmLow && b.cpmHigh) {
          const benchMid = (Number(b.cpmLow) + Number(b.cpmHigh)) / 2;
          const deviationPct = ((avgActualCpm - benchMid) / benchMid) * 100;

          if (Math.abs(deviationPct) > 15) {
            // Check if a pending suggestion already exists
            const existing = await this.suggestionRepo.findOne({
              where: {
                benchmarkId: b.id,
                fieldName: 'cpmMid',
                status: 'pending',
              },
            });
            if (!existing) {
              const newLow = avgActualCpm * 0.85;
              const newHigh = avgActualCpm * 1.15;
              await this.suggestionRepo.save(
                this.suggestionRepo.create({
                  benchmarkId: b.id,
                  fieldName: 'cpmLow',
                  currentValue: Number(b.cpmLow),
                  suggestedValue: Math.round(newLow * 100) / 100,
                  deviationPct: Math.round(deviationPct * 100) / 100,
                  sampleCount: cpmActuals.length,
                  status: 'pending',
                }),
              );
              await this.suggestionRepo.save(
                this.suggestionRepo.create({
                  benchmarkId: b.id,
                  fieldName: 'cpmHigh',
                  currentValue: Number(b.cpmHigh),
                  suggestedValue: Math.round(newHigh * 100) / 100,
                  deviationPct: Math.round(deviationPct * 100) / 100,
                  sampleCount: cpmActuals.length,
                  status: 'pending',
                }),
              );
              created += 2;
            } else {
              skipped++;
            }
          }
        }
      }

      // Compute average actual CPC
      const cpcActuals = actuals.filter(
        (a) => a.actualCpc && Number(a.actualCpc) > 0,
      );
      if (cpcActuals.length >= MIN_ACTUALS_FOR_SUGGESTION) {
        const avgActualCpc =
          cpcActuals.reduce((s, a) => s + Number(a.actualCpc), 0) /
          cpcActuals.length;

        if (b.cpcLow && b.cpcHigh) {
          const benchMid = (Number(b.cpcLow) + Number(b.cpcHigh)) / 2;
          const deviationPct = ((avgActualCpc - benchMid) / benchMid) * 100;

          if (Math.abs(deviationPct) > 15) {
            const existing = await this.suggestionRepo.findOne({
              where: {
                benchmarkId: b.id,
                fieldName: 'cpcLow',
                status: 'pending',
              },
            });
            if (!existing) {
              const newLow = avgActualCpc * 0.85;
              const newHigh = avgActualCpc * 1.15;
              await this.suggestionRepo.save(
                this.suggestionRepo.create({
                  benchmarkId: b.id,
                  fieldName: 'cpcLow',
                  currentValue: Number(b.cpcLow),
                  suggestedValue: Math.round(newLow * 100) / 100,
                  deviationPct: Math.round(deviationPct * 100) / 100,
                  sampleCount: cpcActuals.length,
                  status: 'pending',
                }),
              );
              await this.suggestionRepo.save(
                this.suggestionRepo.create({
                  benchmarkId: b.id,
                  fieldName: 'cpcHigh',
                  currentValue: Number(b.cpcHigh),
                  suggestedValue: Math.round(newHigh * 100) / 100,
                  deviationPct: Math.round(deviationPct * 100) / 100,
                  sampleCount: cpcActuals.length,
                  status: 'pending',
                }),
              );
              created += 2;
            } else {
              skipped++;
            }
          }
        }
      }
    }

    return { created, skipped };
  }

  async acceptSuggestion(id: string, changedBy?: string): Promise<void> {
    const suggestion = await this.suggestionRepo.findOne({
      where: { id },
      relations: ['benchmark'],
    });
    if (!suggestion) throw new NotFoundException(`Suggestion ${id} not found`);
    if (suggestion.status !== 'pending') return;

    const field = suggestion.fieldName as keyof Benchmark;
    await this.update(
      suggestion.benchmarkId,
      { [field]: suggestion.suggestedValue } as UpdateBenchmarkDto,
      changedBy ?? 'auto_tune',
      'auto_tune',
    );

    suggestion.status = 'accepted';
    suggestion.resolvedAt = new Date();
    await this.suggestionRepo.save(suggestion);
  }

  async rejectSuggestion(id: string): Promise<void> {
    const suggestion = await this.suggestionRepo.findOne({ where: { id } });
    if (!suggestion) throw new NotFoundException(`Suggestion ${id} not found`);
    suggestion.status = 'rejected';
    suggestion.resolvedAt = new Date();
    await this.suggestionRepo.save(suggestion);
  }

  // ─── Confidence Scores ──────────────────────────────────────────────────────

  async getConfidenceLevels(): Promise<
    Array<{
      benchmarkId: string;
      platform: string;
      objective: string;
      audienceType: string;
      actualsCount: number;
      level: 'high' | 'medium' | 'low' | 'none';
    }>
  > {
    const benchmarks = await this.benchmarkRepo.find();
    const results: Array<{
      benchmarkId: string;
      platform: string;
      objective: string;
      audienceType: string;
      actualsCount: number;
      level: 'high' | 'medium' | 'low' | 'none';
    }> = [];

    for (const b of benchmarks) {
      const rows = await this.rowRepo.find({
        where: {
          platform: b.platform,
          objective: b.objective,
          audienceType: b.audienceType,
        },
      });

      let actualsCount = 0;
      if (rows.length) {
        const rowIds = rows.map((r) => r.id);
        const count = await this.actualRepo
          .createQueryBuilder('a')
          .where('a.row_id IN (:...rowIds)', { rowIds })
          .getCount();
        actualsCount = count;
      }

      const level =
        actualsCount >= 10
          ? 'high'
          : actualsCount >= 3
            ? 'medium'
            : actualsCount >= 1
              ? 'low'
              : 'none';

      results.push({
        benchmarkId: b.id,
        platform: b.platform,
        objective: b.objective,
        audienceType: b.audienceType,
        actualsCount,
        level,
      });
    }

    return results;
  }

  // ─── KPI Computation ────────────────────────────────────────────────────────

  computeKpis(b: Benchmark, budget: number): CalculatedKpis {
    const benchmark = b;
    const n = (v: number | null | string) => (v == null ? null : Number(v));

    const divRange = (
      budgetVal: number,
      low: number | null,
      high: number | null,
      multiplier = 1,
    ): KpiRange => {
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

// Suppress unused variable warning for TUNABLE_FIELDS
void TUNABLE_FIELDS;
