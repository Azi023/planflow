// ─── Shared number-formatting utilities ──────────────────────────────────────

/** Abbreviate large numbers: 1,234,567 → "1.2M", 12,345 → "12.3K", 8,500 → "8,500" */
export function abbr(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${parseFloat((v / 1_000_000).toFixed(1))}M`;
  if (abs >= 10_000) return `${parseFloat((v / 1_000).toFixed(1))}K`;
  return Math.round(v).toLocaleString('en-US');
}

/** Format a single KPI value with K/M abbreviation */
export function fmtKpi(v: number | null | undefined): string {
  if (v == null) return '—';
  return abbr(v);
}

/** Format a KPI range with K/M abbreviation */
export function fmtKpiRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  if (low == null && high == null) return '—';
  if (low == null) return `< ${fmtKpi(high)}`;
  if (high == null) return `${fmtKpi(low)}+`;
  return `${fmtKpi(low)} – ${fmtKpi(high)}`;
}

/** Full unabbreviated number for tooltip title */
export function fullRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  const lo = low != null ? Math.round(low).toLocaleString('en-US') : '—';
  const hi = high != null ? Math.round(high).toLocaleString('en-US') : '—';
  if (low == null && high == null) return '';
  return `${lo} – ${hi}`;
}

/** Format frequency range: 1 decimal place */
export function fmtFreqRange(
  low: number | null | undefined,
  high: number | null | undefined,
): string {
  const f = (v: number | null | undefined) =>
    v == null ? null : parseFloat(v.toFixed(1)).toString();
  const lo = f(low);
  const hi = f(high);
  if (!lo && !hi) return '—';
  if (!hi) return `${lo}+`;
  if (!lo) return `< ${hi}`;
  return `${lo} – ${hi}`;
}

/**
 * Format a computed CTR percentage: e.g. 0.012 → "0.01%".
 * The computeKpis() already multiplies by 100, so input is already in percent.
 */
export function fmtCtrPct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${parseFloat(v.toFixed(2))}%`;
}

/**
 * Format CTR stored as a fraction (0.001 = 0.1%) → "0.1%".
 * Used for the benchmark table where CTR is stored as a decimal fraction.
 */
export function fmtCtrFraction(v: number | string | null | undefined): string {
  if (v == null) return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  return `${parseFloat((n * 100).toFixed(2))}%`;
}

/** Format a cost value (CPM, CPC, etc.) — max 2 decimals, no trailing zeros */
export function fmtCost(v: number | string | null | undefined, decimals = 2): string {
  if (v == null) return '';
  const n = Number(v);
  if (isNaN(n)) return '';
  return parseFloat(n.toFixed(decimals)).toString();
}

/** Format a benchmark range (handles string values TypeORM returns for DECIMAL columns) */
export function fmtBenchmarkRange(
  low: number | string | null | undefined,
  high: number | string | null | undefined,
  decimals: number,
  isCtr = false,
): string {
  const f = (v: number | string | null | undefined): string | null => {
    if (v == null) return null;
    const n = Number(v);
    if (isNaN(n)) return null;
    if (isCtr) return `${parseFloat((n * 100).toFixed(2))}%`;
    return parseFloat(n.toFixed(decimals)).toString();
  };
  const lo = f(low);
  const hi = f(high);
  if (!lo && !hi) return '—';
  if (!hi) return `${lo}+`;
  if (!lo) return `< ${hi}`;
  if (lo === hi) return lo;
  return `${lo} – ${hi}`;
}

/** Plain number with comma separators, max decimals */
export function fmtNum(v: number | null | undefined, dec = 0): string {
  if (v == null) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: dec });
}

// ─── Buffer helper (shared by Calculator + MediaPlanBuilder) ──────────────────

import type { CalculatedKpis, KpiRange } from './types';

/** Apply a safety-margin buffer to HIGH KPI estimates only (low stays as-is). */
export function applyBufferToKpis(kpis: CalculatedKpis, bufferPct: number): CalculatedKpis {
  if (bufferPct <= 0) return kpis;
  const f = 1 - bufferPct / 100;
  const buf = (r: KpiRange): KpiRange => ({ low: r.low, high: r.high != null ? r.high * f : null });
  return {
    ...kpis,
    impressions: buf(kpis.impressions),
    reach: buf(kpis.reach),
    clicks: buf(kpis.clicks),
    engagements: buf(kpis.engagements),
    videoViews2s: buf(kpis.videoViews2s),
    videoViewsTv: buf(kpis.videoViewsTv),
    landingPageViews: buf(kpis.landingPageViews),
    leads: buf(kpis.leads),
  };
}
