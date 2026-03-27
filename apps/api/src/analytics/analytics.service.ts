import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Benchmark } from '../entities/benchmark.entity';
import { CampaignActual } from '../entities/campaign-actual.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';

// Minimum number of actuals required before a heatmap cell is considered statistically meaningful
const MIN_SAMPLES = 5;

export interface HeatmapCell {
  platform: string;
  objective: string;
  score: number;
  sampleSize: number;
  trend: 'improving' | 'declining' | 'stable' | null;
  hasData: boolean;
}

export interface AccuracyDetail {
  platform: string;
  objective: string;
  benchmarkCpmLow: number | null;
  benchmarkCpmHigh: number | null;
  actualAvgCpm: number | null;
  benchmarkCpcLow: number | null;
  benchmarkCpcHigh: number | null;
  actualAvgCpc: number | null;
  sampleSize: number;
  cpmDeviationPct: number | null;
  cpcDeviationPct: number | null;
  recentEntries: Array<{
    period: string | null;
    actualCpm: number | null;
    actualCpc: number | null;
    spend: number | null;
  }>;
}

export interface SeasonalAlert {
  platform: string;
  objective: string;
  audienceType: string;
  currentMonthAvg: number | null;
  annualAvg: number | null;
  deviationPct: number;
  direction: 'higher' | 'lower';
  note: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Benchmark)
    private readonly benchmarkRepo: Repository<Benchmark>,
    @InjectRepository(CampaignActual)
    private readonly actualRepo: Repository<CampaignActual>,
    @InjectRepository(MediaPlanRow)
    private readonly rowRepo: Repository<MediaPlanRow>,
  ) {}

  async getAccuracyHeatmap(): Promise<{
    cells: HeatmapCell[];
    platforms: string[];
    objectives: string[];
  }> {
    // Get all unique platform+objective combos from benchmarks
    const benchmarks = await this.benchmarkRepo.find();
    const comboMap = new Map<string, { platform: string; objective: string }>();
    for (const b of benchmarks) {
      const key = `${b.platform}|${b.objective}`;
      if (!comboMap.has(key)) {
        comboMap.set(key, { platform: b.platform, objective: b.objective });
      }
    }

    const cells: HeatmapCell[] = [];

    for (const [, combo] of comboMap) {
      const rows = await this.rowRepo.find({
        where: { platform: combo.platform, objective: combo.objective },
      });
      if (!rows.length) {
        cells.push({
          ...combo,
          score: 0,
          sampleSize: 0,
          trend: null,
          hasData: false,
        });
        continue;
      }

      const rowIds = rows.map((r) => r.id);
      const actuals = await this.actualRepo
        .createQueryBuilder('a')
        .where('a.row_id IN (:...rowIds)', { rowIds })
        .orderBy('a.created_at', 'DESC')
        .getMany();

      if (!actuals.length) {
        cells.push({
          ...combo,
          score: 0,
          sampleSize: 0,
          trend: null,
          hasData: false,
        });
        continue;
      }

      // Match each actual to its row's projected KPIs and calculate accuracy
      const rowMap = new Map(rows.map((r) => [r.id, r]));
      const scores: number[] = [];

      for (const actual of actuals) {
        if (!actual.rowId) continue;
        const row = rowMap.get(actual.rowId);
        if (!row?.projectedKpis) continue;

        const kpis = row.projectedKpis as Record<
          string,
          { low?: number | null; high?: number | null }
        >;

        // Use impressions for accuracy scoring if available
        if (
          kpis.impressions?.low &&
          kpis.impressions?.high &&
          actual.actualImpressions
        ) {
          const score = this.calcAccuracy(
            kpis.impressions.low,
            kpis.impressions.high,
            Number(actual.actualImpressions),
          );
          scores.push(score);
        } else if (kpis.reach?.low && kpis.reach?.high && actual.actualReach) {
          const score = this.calcAccuracy(
            kpis.reach.low,
            kpis.reach.high,
            Number(actual.actualReach),
          );
          scores.push(score);
        }
      }

      if (!scores.length) {
        cells.push({
          ...combo,
          score: 50,
          sampleSize: actuals.length,
          trend: null,
          hasData: actuals.length >= MIN_SAMPLES,
        });
        continue;
      }

      const avgScore = Math.round(
        scores.reduce((s, x) => s + x, 0) / scores.length,
      );

      // Trend: compare first half vs second half
      let trend: 'improving' | 'declining' | 'stable' | null = null;
      if (scores.length >= 4) {
        const mid = Math.floor(scores.length / 2);
        const older = scores.slice(mid);
        const newer = scores.slice(0, mid);
        const olderAvg = older.reduce((s, x) => s + x, 0) / older.length;
        const newerAvg = newer.reduce((s, x) => s + x, 0) / newer.length;
        const diff = newerAvg - olderAvg;
        if (diff > 5) trend = 'improving';
        else if (diff < -5) trend = 'declining';
        else trend = 'stable';
      }

      cells.push({
        ...combo,
        score: avgScore,
        sampleSize: scores.length,
        trend,
        hasData: scores.length >= MIN_SAMPLES,
      });
    }

    const platformSet = new Set(cells.map((c) => c.platform));
    const objectiveSet = new Set(cells.map((c) => c.objective));

    return {
      cells,
      platforms: [...platformSet].sort(),
      objectives: [...objectiveSet].sort(),
    };
  }

  async getAccuracyDetail(
    platform: string,
    objective: string,
  ): Promise<AccuracyDetail> {
    const benchmarks = await this.benchmarkRepo.find({
      where: { platform, objective },
    });

    const cpmLows = benchmarks
      .map((b) => Number(b.cpmLow))
      .filter((v) => v > 0);
    const cpmHighs = benchmarks
      .map((b) => Number(b.cpmHigh))
      .filter((v) => v > 0);
    const cpcLows = benchmarks
      .map((b) => Number(b.cpcLow))
      .filter((v) => v > 0);
    const cpcHighs = benchmarks
      .map((b) => Number(b.cpcHigh))
      .filter((v) => v > 0);

    const benchmarkCpmLow = cpmLows.length
      ? cpmLows.reduce((s, x) => s + x, 0) / cpmLows.length
      : null;
    const benchmarkCpmHigh = cpmHighs.length
      ? cpmHighs.reduce((s, x) => s + x, 0) / cpmHighs.length
      : null;
    const benchmarkCpcLow = cpcLows.length
      ? cpcLows.reduce((s, x) => s + x, 0) / cpcLows.length
      : null;
    const benchmarkCpcHigh = cpcHighs.length
      ? cpcHighs.reduce((s, x) => s + x, 0) / cpcHighs.length
      : null;

    const rows = await this.rowRepo.find({ where: { platform, objective } });
    const actuals =
      rows.length > 0
        ? await this.actualRepo
            .createQueryBuilder('a')
            .where('a.row_id IN (:...rowIds)', {
              rowIds: rows.map((r) => r.id),
            })
            .orderBy('a.created_at', 'DESC')
            .limit(50)
            .getMany()
        : [];

    const cpmActuals = actuals.filter(
      (a) => a.actualCpm && Number(a.actualCpm) > 0,
    );
    const cpcActuals = actuals.filter(
      (a) => a.actualCpc && Number(a.actualCpc) > 0,
    );

    const actualAvgCpm = cpmActuals.length
      ? cpmActuals.reduce((s, a) => s + Number(a.actualCpm), 0) /
        cpmActuals.length
      : null;
    const actualAvgCpc = cpcActuals.length
      ? cpcActuals.reduce((s, a) => s + Number(a.actualCpc), 0) /
        cpcActuals.length
      : null;

    let cpmDeviationPct: number | null = null;
    if (actualAvgCpm && benchmarkCpmLow && benchmarkCpmHigh) {
      const mid = (benchmarkCpmLow + benchmarkCpmHigh) / 2;
      cpmDeviationPct = Math.round(((actualAvgCpm - mid) / mid) * 100);
    }

    let cpcDeviationPct: number | null = null;
    if (actualAvgCpc && benchmarkCpcLow && benchmarkCpcHigh) {
      const mid = (benchmarkCpcLow + benchmarkCpcHigh) / 2;
      cpcDeviationPct = Math.round(((actualAvgCpc - mid) / mid) * 100);
    }

    return {
      platform,
      objective,
      benchmarkCpmLow,
      benchmarkCpmHigh,
      actualAvgCpm,
      benchmarkCpcLow,
      benchmarkCpcHigh,
      actualAvgCpc,
      sampleSize: actuals.length,
      cpmDeviationPct,
      cpcDeviationPct,
      recentEntries: actuals.slice(0, 10).map((a) => ({
        period: a.periodLabel,
        actualCpm: a.actualCpm ? Number(a.actualCpm) : null,
        actualCpc: a.actualCpc ? Number(a.actualCpc) : null,
        spend: a.actualSpend ? Number(a.actualSpend) : null,
      })),
    };
  }

  async getSeasonalAlerts(
    platform?: string,
    objective?: string,
    month?: number,
  ): Promise<SeasonalAlert[]> {
    const currentMonth = month ?? new Date().getMonth() + 1; // 1-12

    // Get all actuals that have a period date and actual CPM
    const qb = this.actualRepo
      .createQueryBuilder('a')
      .innerJoin('a.row', 'row')
      .select([
        'row.platform AS platform',
        'row.objective AS objective',
        'row.audience_type AS audience_type',
        'EXTRACT(MONTH FROM a.period_start) AS month',
        'AVG(CAST(a.actual_cpm AS FLOAT)) AS avg_cpm',
        'COUNT(*) AS cnt',
      ])
      .where('a.period_start IS NOT NULL')
      .andWhere('a.actual_cpm IS NOT NULL')
      .andWhere('CAST(a.actual_cpm AS FLOAT) > 0')
      .groupBy(
        'row.platform, row.objective, row.audience_type, EXTRACT(MONTH FROM a.period_start)',
      );

    if (platform) qb.andWhere('row.platform = :platform', { platform });
    if (objective) qb.andWhere('row.objective = :objective', { objective });

    const monthlyData = (await qb.getRawMany()) as Array<{
      platform: string;
      objective: string;
      audience_type: string;
      month: string;
      avg_cpm: string;
      cnt: string;
    }>;

    if (!monthlyData.length) return [];

    // Group by platform+objective+audienceType
    const groupMap = new Map<
      string,
      Array<{ month: number; avgCpm: number; count: number }>
    >();

    for (const row of monthlyData) {
      const key = `${row.platform}|${row.objective}|${row.audience_type}`;
      const entry = groupMap.get(key) ?? [];
      entry.push({
        month: Number(row.month),
        avgCpm: Number(row.avg_cpm),
        count: Number(row.cnt),
      });
      groupMap.set(key, entry);
    }

    const alerts: SeasonalAlert[] = [];

    for (const [key, entries] of groupMap) {
      const [plt, obj, audType] = key.split('|');

      // Calculate annual average CPM
      const totalCpm = entries.reduce((s, e) => s + e.avgCpm * e.count, 0);
      const totalCount = entries.reduce((s, e) => s + e.count, 0);
      const annualAvg = totalCount > 0 ? totalCpm / totalCount : null;

      // Data gating: require at least 10 total actuals AND data from at least 3 distinct months
      // to avoid misleading seasonal alerts from sparse data
      const distinctMonthCount = entries.length;
      if (totalCount < 10 || distinctMonthCount < 3) continue;

      // Get current month average
      const currentEntry = entries.find((e) => e.month === currentMonth);
      const currentMonthAvg = currentEntry?.avgCpm ?? null;

      if (!annualAvg || !currentMonthAvg) continue;

      const deviationPct = ((currentMonthAvg - annualAvg) / annualAvg) * 100;

      if (Math.abs(deviationPct) > 20) {
        const direction = deviationPct > 0 ? 'higher' : 'lower';
        const monthName = MONTH_NAMES[currentMonth - 1];
        const pct = Math.abs(Math.round(deviationPct));

        alerts.push({
          platform: plt,
          objective: obj,
          audienceType: audType,
          currentMonthAvg,
          annualAvg,
          deviationPct: Math.round(deviationPct),
          direction,
          note: `${monthName} campaigns typically see ${pct}% ${direction} CPMs`,
        });
      }
    }

    return alerts;
  }

  // Note: Monthly trend data requires at least 3 distinct months to be statistically meaningful.
  // The caller should check rows.length >= 3 before drawing trend conclusions.
  async getMonthlyTrend(
    platform: string,
    objective: string,
  ): Promise<
    Array<{
      month: number;
      monthName: string;
      avgCpm: number | null;
      count: number;
    }>
  > {
    const qb = this.actualRepo
      .createQueryBuilder('a')
      .innerJoin('a.row', 'row')
      .select([
        'EXTRACT(MONTH FROM a.period_start) AS month',
        'AVG(CAST(a.actual_cpm AS FLOAT)) AS avg_cpm',
        'COUNT(*) AS cnt',
      ])
      .where('row.platform = :platform', { platform })
      .andWhere('row.objective = :objective', { objective })
      .andWhere('a.period_start IS NOT NULL')
      .andWhere('a.actual_cpm IS NOT NULL')
      .andWhere('CAST(a.actual_cpm AS FLOAT) > 0')
      .groupBy('EXTRACT(MONTH FROM a.period_start)')
      .orderBy('month', 'ASC');

    const rows = (await qb.getRawMany()) as Array<{
      month: string;
      avg_cpm: string;
      cnt: string;
    }>;

    return rows.map((r) => ({
      month: Number(r.month),
      monthName: MONTH_NAMES[Number(r.month) - 1],
      avgCpm: r.avg_cpm ? Number(r.avg_cpm) : null,
      count: Number(r.cnt),
    }));
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
