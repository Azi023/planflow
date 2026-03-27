/**
 * Simulated actuals seeder — Sprint 3A
 * Generates 80-100 realistic campaign actuals across 15-20 plans
 * Distributed over Oct 2025 – Mar 2026 for seasonal analysis
 *
 * Run with:
 *   cd apps/api && npx ts-node -r tsconfig-paths/register src/seed/seed-actuals.ts
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { CampaignActual } from '../entities/campaign-actual.entity';
import { MediaPlanRow } from '../entities/media-plan-row.entity';
import { Benchmark } from '../entities/benchmark.entity';
import { BenchmarkHistory } from '../entities/benchmark-history.entity';
import { BenchmarkSuggestion } from '../entities/benchmark-suggestion.entity';
import { MediaPlan } from '../entities/media-plan.entity';
import { Client } from '../entities/client.entity';
import { Product } from '../entities/product.entity';
import { Audience } from '../entities/audience.entity';
import { CreativeType } from '../entities/creative-type.entity';
import { User } from '../entities/user.entity';
import { PlanTemplate } from '../entities/plan-template.entity';
import { PlanComment } from '../entities/plan-comment.entity';

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'planflow',
  username: process.env.DB_USER ?? 'planflow',
  password: process.env.DB_PASS ?? 'planflow_dev',
  entities: [
    Benchmark, BenchmarkHistory, BenchmarkSuggestion,
    Client, Product, MediaPlan, MediaPlanRow,
    Audience, CreativeType, User, CampaignActual,
    PlanTemplate, PlanComment,
  ],
  synchronize: false,
});

// Realistic Sri Lankan digital ad market CPM/CPC values (LKR unless noted)
const PLATFORM_ACTUALS: Record<string, {
  cpmRange: [number, number];
  cpcRange: [number, number];
  ctrRange: [number, number];
  frequencyRange: [number, number];
}> = {
  meta: {
    cpmRange: [42, 78],
    cpcRange: [3.5, 8.5],
    ctrRange: [0.012, 0.035],
    frequencyRange: [1.8, 3.5],
  },
  meta_ig: {
    cpmRange: [55, 95],
    cpcRange: [4.0, 10.0],
    ctrRange: [0.010, 0.028],
    frequencyRange: [1.5, 3.2],
  },
  tiktok: {
    cpmRange: [45, 80],
    cpcRange: [5.0, 12.0],
    ctrRange: [0.015, 0.040],
    frequencyRange: [1.2, 2.8],
  },
  gdn: {
    cpmRange: [0.065, 0.095],  // USD
    cpcRange: [0.025, 0.090],  // USD
    ctrRange: [0.001, 0.004],
    frequencyRange: [2.0, 4.5],
  },
  youtube_video: {
    cpmRange: [0.30, 0.55],   // USD
    cpcRange: [0.15, 0.35],   // USD
    ctrRange: [0.005, 0.015],
    frequencyRange: [1.5, 3.0],
  },
  search: {
    cpmRange: [4.0, 10.0],    // less meaningful for search
    cpcRange: [4.5, 11.0],
    ctrRange: [0.030, 0.080],
    frequencyRange: [1.0, 1.5],
  },
  meta_page_like: {
    cpmRange: [60, 110],
    cpcRange: [5.0, 12.0],
    ctrRange: [0.008, 0.022],
    frequencyRange: [1.5, 3.0],
  },
  ig: {
    cpmRange: [48, 85],
    cpcRange: [7.0, 15.0],
    ctrRange: [0.010, 0.025],
    frequencyRange: [1.5, 3.0],
  },
};

const DEFAULT_ACTUALS = {
  cpmRange: [50, 90] as [number, number],
  cpcRange: [5.0, 12.0] as [number, number],
  ctrRange: [0.012, 0.030] as [number, number],
  frequencyRange: [1.5, 3.0] as [number, number],
};

// December/January seasonal multiplier (peak season in Sri Lanka)
const SEASONAL_MULTIPLIERS: Record<number, number> = {
  12: 1.28,  // December — peak, higher CPMs
  1: 1.15,   // January — post-peak
  11: 1.08,  // November — pre-peak
  10: 1.00,  // Base
  2: 0.92,   // February — off-season
  3: 0.88,   // March — lower demand
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function roundTo(n: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(n * factor) / factor;
}

// Generate a random date within a specific month
function dateInMonth(year: number, month: number): Date {
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.floor(rand(1, daysInMonth));
  return new Date(year, month - 1, day);
}

// Period distribution: Oct 2025 – Mar 2026
const PERIODS = [
  { year: 2025, month: 10, label: 'Oct 2025' },
  { year: 2025, month: 11, label: 'Nov 2025' },
  { year: 2025, month: 12, label: 'Dec 2025' },
  { year: 2026, month: 1,  label: 'Jan 2026' },
  { year: 2026, month: 2,  label: 'Feb 2026' },
  { year: 2026, month: 3,  label: 'Mar 2026' },
];

async function main() {
  await ds.initialize();
  const rowRepo = ds.getRepository(MediaPlanRow);
  const actualRepo = ds.getRepository(CampaignActual);

  // Check if we already have seeded actuals
  const existingCount = await actualRepo.count();
  if (existingCount > 0) {
    console.log(`Already have ${existingCount} actuals. Skipping seed.`);
    await ds.destroy();
    return;
  }

  // Fetch plan rows with projected_kpis and budgets
  const rows = await rowRepo
    .createQueryBuilder('r')
    .innerJoin('r.plan', 'p')
    .innerJoin('p.client', 'c')
    .where("r.projected_kpis::text <> '{}'")
    .andWhere('r.budget IS NOT NULL')
    .andWhere('r.budget > 0')
    .andWhere('r.platform IN (:...platforms)', {
      platforms: ['meta', 'meta_ig', 'tiktok', 'gdn', 'youtube_video', 'search', 'ig', 'meta_page_like'],
    })
    .orderBy('r.budget', 'DESC')
    .limit(100)
    .getMany();

  console.log(`Found ${rows.length} eligible rows for seeding.`);

  if (!rows.length) {
    console.log('No eligible rows found. Exiting.');
    await ds.destroy();
    return;
  }

  // Pick 40 rows distributed across different plans
  const plansSeen = new Set<string>();
  const selectedRows: MediaPlanRow[] = [];

  for (const row of rows) {
    if (selectedRows.length >= 40) break;
    // Take up to 3 rows per plan
    const rowsForThisPlan = selectedRows.filter((r) => r.planId === row.planId).length;
    if (rowsForThisPlan < 3) {
      selectedRows.push(row);
      plansSeen.add(row.planId);
    }
  }

  console.log(`Selected ${selectedRows.length} rows from ${plansSeen.size} plans.`);

  const actuals: Partial<CampaignActual>[] = [];
  let totalCreated = 0;

  for (const row of selectedRows) {
    const platformConfig = PLATFORM_ACTUALS[row.platform] ?? DEFAULT_ACTUALS;

    // Each row gets 2-3 actuals in different months
    const numPeriods = Math.floor(rand(2, 4));
    const shuffledPeriods = [...PERIODS].sort(() => Math.random() - 0.5).slice(0, numPeriods);

    for (const period of shuffledPeriods) {
      const seasonalMult = SEASONAL_MULTIPLIERS[period.month] ?? 1.0;

      const budget = Number(row.budget) ?? 0;
      // Simulate spending ~85-100% of budget
      const spendPct = rand(0.85, 1.00);
      const actualSpend = roundTo(budget * spendPct, 2);

      const actualCpm = roundTo(
        rand(...platformConfig.cpmRange) * seasonalMult,
        2,
      );
      const actualCpc = roundTo(
        rand(...platformConfig.cpcRange) * seasonalMult,
        2,
      );
      const actualCtr = roundTo(rand(...platformConfig.ctrRange), 6);
      const actualFrequency = roundTo(rand(...platformConfig.frequencyRange), 2);

      // Calculate derived metrics
      const actualImpressions =
        actualCpm > 0 ? Math.round((actualSpend / actualCpm) * 1000) : null;
      const actualClicks =
        actualImpressions && actualCtr
          ? Math.round(actualImpressions * actualCtr)
          : null;
      const actualReach =
        actualImpressions && actualFrequency && actualFrequency > 0
          ? Math.round(actualImpressions / actualFrequency)
          : null;

      const periodStart = dateInMonth(period.year, period.month);
      const periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + Math.floor(rand(7, 28)));

      actuals.push({
        planId: row.planId,
        rowId: row.id,
        periodLabel: period.label,
        periodStart,
        periodEnd,
        actualSpend,
        actualCpm,
        actualCpc,
        actualCtr,
        actualFrequency,
        actualImpressions,
        actualClicks,
        actualReach,
        source: 'manual',
        notes: `Simulated data for ${period.label}`,
      });
      totalCreated++;
    }
  }

  // Save in batches
  const BATCH = 20;
  for (let i = 0; i < actuals.length; i += BATCH) {
    const batch = actuals.slice(i, i + BATCH);
    await actualRepo.save(batch.map((a) => actualRepo.create(a)));
    process.stdout.write(`\rSaved ${Math.min(i + BATCH, actuals.length)}/${actuals.length}`);
  }

  console.log(`\n✓ Seeded ${totalCreated} actuals across ${plansSeen.size} plans.`);
  await ds.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
