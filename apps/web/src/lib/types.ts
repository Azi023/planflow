export type AudienceType = 'mass' | 'niche';
export type Objective = 'awareness' | 'engagement' | 'traffic' | 'leads';

export interface Benchmark {
  id: string;
  audienceType: AudienceType;
  objective: Objective;
  platform: string;
  minDuration: string | null;
  minDailyBudget: string | null;
  currency: string;
  cpmLow: number | null;
  cpmHigh: number | null;
  cprLow: number | null;
  cprHigh: number | null;
  cpeLow: number | null;
  cpeHigh: number | null;
  cpcLow: number | null;
  cpcHigh: number | null;
  ctrLow: number | null;
  ctrHigh: number | null;
  cpv2sLow: number | null;
  cpv2sHigh: number | null;
  cpvTvLow: number | null;
  cpvTvHigh: number | null;
  cplvLow: number | null;
  cplvHigh: number | null;
  cplLow: number | null;
  cplHigh: number | null;
  pageLikeLow: number | null;
  pageLikeHigh: number | null;
  frequency: string | null;
  updatedAt: string;
}

export interface Audience {
  id: string;
  name: string;
  audienceType: string;
  location: string | null;
  ageMin: number | null;
  ageMax: number | null;
  gender: string | null;
  interests: string | null;
  behaviors: string | null;
  demographics: string | null;
  estimatedSizeMin: string | null;
  estimatedSizeMax: string | null;
  clientId: string | null;
}

export interface CreativeType {
  id: string;
  name: string;
  category: string;
}

export interface Client {
  id: string;
  name: string;
  products: Product[];
  defaultFee1Pct: number;
  defaultFee1Label: string;
  defaultFee2Pct: number | null;
  defaultFee2Label: string | null;
  defaultCurrency: string;
}

export interface Product {
  id: string;
  clientId: string;
  name: string;
}

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

export interface MediaPlanRow {
  id: string;
  platform: string;
  adType: string | null;
  objective: string | null;
  audienceType: string | null;
  audienceName: string | null;
  audienceSize: string | null;
  targetingCriteria: string | null;
  creative: string | null;
  budget: number | null;
  benchmarkId: string | null;
  projectedKpis: Record<string, unknown>;
  sortOrder: number;
  country: string | null;
  buyType: string | null;
  videoViewsLow: number | null;
  videoViewsHigh: number | null;
  cpmUsed: number | null;
  percentage: number | null;
  platformRangeCpm: string | null;
  platformRangeCpl: string | null;
  notes: string | null;
}

export interface MediaPlan {
  id: string;
  clientId: string | null;
  productId: string | null;
  variantGroupId: string | null;
  campaignName: string | null;
  campaignPeriod: string | null;
  startDate: string | null;
  endDate: string | null;
  bufferPct: number;
  totalBudget: number | null;
  fee1Pct: number;
  fee1Label: string;
  fee2Pct: number | null;
  fee2Label: string | null;
  referenceNumber: string | null;
  preparedBy: string | null;
  currency: string;
  usdExchangeRate: number | null;
  variantName: string;
  notes: string | null;
  status: string;
  createdAt?: string;
  client?: { id: string; name: string } | null;
  product?: { id: string; name: string } | null;
  rows: MediaPlanRow[];
}

export const PLATFORMS = [
  { value: 'meta_ig', label: 'Meta + IG' },
  { value: 'meta', label: 'Meta only' },
  { value: 'ig', label: 'IG only' },
  { value: 'ig_follower', label: 'IG Follower' },
  { value: 'meta_page_like', label: 'Meta Page Like' },
  { value: 'gdn', label: 'GDN' },
  { value: 'youtube_video', label: 'YouTube Video Views' },
  { value: 'youtube_bumper', label: 'YouTube Bumper' },
  { value: 'search', label: 'Search' },
  { value: 'demand_gen', label: 'Demand Gen' },
  { value: 'perf_max', label: 'Performance Max' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
] as const;

export const OBJECTIVES = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'traffic', label: 'Traffic' },
  { value: 'leads', label: 'Leads' },
] as const;

export const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.value, p.label]),
);

export const OBJECTIVE_LABEL: Record<string, string> = Object.fromEntries(
  OBJECTIVES.map((o) => [o.value, o.label]),
);

// ─── Sprint 3A: Analytics Types ───────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export interface ConfidenceScore {
  benchmarkId: string;
  platform: string;
  objective: string;
  audienceType: string;
  actualsCount: number;
  level: ConfidenceLevel;
}

export interface BenchmarkSuggestion {
  id: string;
  benchmarkId: string;
  fieldName: string;
  currentValue: number | null;
  suggestedValue: number;
  deviationPct: number;
  sampleCount: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  resolvedAt: string | null;
  benchmark?: Benchmark;
}

export interface BenchmarkHistoryEntry {
  id: string;
  benchmarkId: string;
  fieldChanged: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string | null;
  source: 'manual' | 'auto_tune' | 'csv_import';
  changedAt: string;
}

export interface HeatmapCell {
  platform: string;
  objective: string;
  score: number;
  sampleSize: number;
  trend: 'improving' | 'declining' | 'stable' | null;
  hasData: boolean;
}

export interface AccuracyHeatmap {
  cells: HeatmapCell[];
  platforms: string[];
  objectives: string[];
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

export interface MonthlyTrendEntry {
  month: number;
  monthName: string;
  avgCpm: number | null;
  count: number;
}
