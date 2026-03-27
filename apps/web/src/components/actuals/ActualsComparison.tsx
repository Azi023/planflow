'use client';

import { useMemo, useState } from 'react';
import type { MediaPlanRow } from '@/lib/types';
import type { CampaignActual } from '@/lib/api';
import { PLATFORM_LABEL } from '@/lib/types';
import { abbr } from '@/lib/format';

interface Props {
  planRows: MediaPlanRow[];
  actuals: CampaignActual[];
  currency: string;
}

interface KpiRange {
  low: number | null;
  high: number | null;
}

function getProjected(row: MediaPlanRow) {
  const kpis = row.projectedKpis as Record<string, KpiRange | null> | null;
  return {
    impressions: kpis?.impressions ?? { low: null, high: null },
    reach: kpis?.reach ?? { low: null, high: null },
    clicks: kpis?.clicks ?? { low: null, high: null },
  };
}

function varianceColor(actual: number, projected: number, lowerIsBetter = false): string {
  if (!projected || !actual) return '#99A1B7';
  const pctDiff = ((actual - projected) / projected) * 100;
  const isGood = lowerIsBetter ? pctDiff <= 0 : pctDiff >= 0;
  const magnitude = Math.abs(pctDiff);
  if (magnitude <= 10) return '#F6B100';
  return isGood ? '#17C653' : '#F8285A';
}

function formatPct(actual: number, projected: number): string {
  if (!projected) return '—';
  const pct = ((actual - projected) / projected) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

interface VarianceCellProps {
  actual: number | null;
  projected: number | null;
  lowerIsBetter?: boolean;
}

function VarianceCell({ actual, projected, lowerIsBetter = false }: VarianceCellProps) {
  if (actual == null || !projected) {
    return (
      <td className="px-3 py-2 text-center text-[#99A1B7] border border-[#E1E3EA] text-xs">
        —
      </td>
    );
  }
  const color = varianceColor(actual, projected, lowerIsBetter);
  return (
    <td className="px-3 py-2 border border-[#E1E3EA] text-xs">
      <div className="flex flex-col items-end gap-0.5">
        <span className="tabular-nums font-medium text-[#071437]">{abbr(actual)}</span>
        <span className="tabular-nums text-[10px]" style={{ color }}>
          {formatPct(actual, projected)}
        </span>
      </div>
    </td>
  );
}

export function ActualsComparison({ planRows, actuals, currency }: Props) {
  const [activePeriod, setActivePeriod] = useState<string>('__all__');

  const periods = useMemo(() => {
    const set = new Set<string>();
    for (const a of actuals) {
      set.add(a.periodLabel ?? a.periodStart ?? 'Unknown');
    }
    return [...set];
  }, [actuals]);

  const filteredActuals = useMemo(
    () =>
      activePeriod === '__all__'
        ? actuals
        : actuals.filter(
            (a) => (a.periodLabel ?? a.periodStart ?? 'Unknown') === activePeriod,
          ),
    [actuals, activePeriod],
  );

  const totals = useMemo(
    () =>
      filteredActuals.reduce(
        (acc, a) => ({
          impressions: acc.impressions + Number(a.actualImpressions ?? 0),
          reach: acc.reach + Number(a.actualReach ?? 0),
          clicks: acc.clicks + Number(a.actualClicks ?? 0),
          spend: acc.spend + Number(a.actualSpend ?? 0),
        }),
        { impressions: 0, reach: 0, clicks: 0, spend: 0 },
      ),
    [filteredActuals],
  );

  const projectedTotals = useMemo(
    () =>
      planRows.reduce(
        (acc, r) => {
          const p = getProjected(r);
          return {
            impressions: acc.impressions + (p.impressions.low ?? 0),
            reach: acc.reach + (p.reach.low ?? 0),
            clicks: acc.clicks + (p.clicks.low ?? 0),
            budget: acc.budget + Number(r.budget ?? 0),
          };
        },
        { impressions: 0, reach: 0, clicks: 0, budget: 0 },
      ),
    [planRows],
  );

  const actualsByRow = useMemo(() => {
    const map = new Map<string, { impressions: number; reach: number; clicks: number; spend: number }>();
    for (const a of filteredActuals) {
      if (!a.rowId) continue;
      const prev = map.get(a.rowId) ?? { impressions: 0, reach: 0, clicks: 0, spend: 0 };
      map.set(a.rowId, {
        impressions: prev.impressions + Number(a.actualImpressions ?? 0),
        reach: prev.reach + Number(a.actualReach ?? 0),
        clicks: prev.clicks + Number(a.actualClicks ?? 0),
        spend: prev.spend + Number(a.actualSpend ?? 0),
      });
    }
    return map;
  }, [filteredActuals]);

  if (actuals.length === 0) {
    return (
      <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-6 py-8 text-center">
        <p className="text-sm text-[#99A1B7]">No actuals data yet.</p>
        <p className="text-xs text-[#99A1B7] mt-1">
          Enter actuals above to see the projected vs actual comparison.
        </p>
      </div>
    );
  }

  const summaryCards = [
    { label: 'IMPRESSIONS', actual: totals.impressions, projected: projectedTotals.impressions, lowerIsBetter: false },
    { label: 'REACH', actual: totals.reach, projected: projectedTotals.reach, lowerIsBetter: false },
    { label: 'CLICKS', actual: totals.clicks, projected: projectedTotals.clicks, lowerIsBetter: false },
    { label: `SPEND (${currency})`, actual: totals.spend, projected: projectedTotals.budget, lowerIsBetter: true },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#071437]">Projected vs Actual</p>
        {periods.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActivePeriod('__all__')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activePeriod === '__all__'
                  ? 'bg-[#1B84FF] text-white'
                  : 'bg-[#F1F1F4] text-[#4B5675] hover:bg-[#E1E3EA]'
              }`}
            >
              All Periods
            </button>
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setActivePeriod(p)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  activePeriod === p
                    ? 'bg-[#1B84FF] text-white'
                    : 'bg-[#F1F1F4] text-[#4B5675] hover:bg-[#E1E3EA]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const hasBoth = card.actual > 0 && card.projected > 0;
          const color = hasBoth
            ? varianceColor(card.actual, card.projected, card.lowerIsBetter)
            : '#99A1B7';
          const pctStr = hasBoth ? formatPct(card.actual, card.projected) : null;

          return (
            <div
              key={card.label}
              className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-4 py-4"
            >
              <p className="text-[10px] font-semibold text-[#99A1B7] tracking-wide uppercase mb-3">
                {card.label}
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#99A1B7]">Projected</span>
                  <span className="text-xs tabular-nums font-medium text-[#071437]">
                    {card.projected > 0 ? abbr(card.projected) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#99A1B7]">Actual</span>
                  <span className="text-xs tabular-nums font-medium text-[#071437]">
                    {card.actual > 0 ? abbr(card.actual) : '—'}
                  </span>
                </div>
                {pctStr && (
                  <div
                    className="text-sm font-semibold tabular-nums text-right pt-1"
                    style={{ color }}
                  >
                    {pctStr}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Per-row table */}
      <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E1E3EA]">
          <p className="text-sm font-semibold text-[#071437]">Per-Row Comparison</p>
          <p className="text-xs text-[#99A1B7] mt-0.5">
            Projected = conservative (low) estimate.
            Actual = total across{' '}
            {activePeriod === '__all__' ? 'all periods' : `"${activePeriod}"`}.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9]">
                <th className="text-left px-3 py-2.5 font-medium text-[#4B5675] border border-[#E1E3EA] whitespace-nowrap">Platform</th>
                <th className="text-left px-3 py-2.5 font-medium text-[#4B5675] border border-[#E1E3EA] whitespace-nowrap">Audience</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#99A1B7] border border-[#E1E3EA] whitespace-nowrap">Impr. (Proj)</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#4B5675] border border-[#E1E3EA] whitespace-nowrap">Impr. (Act / Var)</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#99A1B7] border border-[#E1E3EA] whitespace-nowrap">Reach (Proj)</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#4B5675] border border-[#E1E3EA] whitespace-nowrap">Reach (Act / Var)</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#99A1B7] border border-[#E1E3EA] whitespace-nowrap">Clicks (Proj)</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#4B5675] border border-[#E1E3EA] whitespace-nowrap">Clicks (Act / Var)</th>
                <th className="text-right px-3 py-2.5 font-medium text-[#4B5675] border border-[#E1E3EA] whitespace-nowrap">Spend</th>
              </tr>
            </thead>
            <tbody>
              {planRows.map((row) => {
                const proj = getProjected(row);
                const rowActuals = actualsByRow.get(row.id);
                return (
                  <tr key={row.id} className="hover:bg-[#F9F9F9]">
                    <td className="px-3 py-2 border border-[#E1E3EA] font-medium text-[#071437] whitespace-nowrap">
                      {PLATFORM_LABEL[row.platform] ?? row.platform}
                    </td>
                    <td className="px-3 py-2 border border-[#E1E3EA] text-[#4B5675] whitespace-nowrap">
                      {row.audienceName ?? '—'}
                    </td>
                    <td className="px-3 py-2 border border-[#E1E3EA] text-right tabular-nums text-[#99A1B7]">
                      {proj.impressions.low != null ? abbr(proj.impressions.low) : '—'}
                    </td>
                    <VarianceCell
                      actual={rowActuals?.impressions ?? null}
                      projected={proj.impressions.low}
                    />
                    <td className="px-3 py-2 border border-[#E1E3EA] text-right tabular-nums text-[#99A1B7]">
                      {proj.reach.low != null ? abbr(proj.reach.low) : '—'}
                    </td>
                    <VarianceCell
                      actual={rowActuals?.reach ?? null}
                      projected={proj.reach.low}
                    />
                    <td className="px-3 py-2 border border-[#E1E3EA] text-right tabular-nums text-[#99A1B7]">
                      {proj.clicks.low != null ? abbr(proj.clicks.low) : '—'}
                    </td>
                    <VarianceCell
                      actual={rowActuals?.clicks ?? null}
                      projected={proj.clicks.low}
                    />
                    <td className="px-3 py-2 border border-[#E1E3EA] text-right tabular-nums text-[#4B5675]">
                      {rowActuals?.spend ? abbr(rowActuals.spend) : '—'}
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="bg-[#F1F1F4] font-semibold">
                <td className="px-3 py-2 border border-[#E1E3EA] text-[#071437]" colSpan={2}>
                  TOTAL
                </td>
                <td className="px-3 py-2 border border-[#E1E3EA] text-right tabular-nums text-[#99A1B7]">
                  {projectedTotals.impressions > 0 ? abbr(projectedTotals.impressions) : '—'}
                </td>
                <VarianceCell
                  actual={totals.impressions > 0 ? totals.impressions : null}
                  projected={projectedTotals.impressions}
                />
                <td className="px-3 py-2 border border-[#E1E3EA] text-right tabular-nums text-[#99A1B7]">
                  {projectedTotals.reach > 0 ? abbr(projectedTotals.reach) : '—'}
                </td>
                <VarianceCell
                  actual={totals.reach > 0 ? totals.reach : null}
                  projected={projectedTotals.reach}
                />
                <td className="px-3 py-2 border border-[#E1E3EA] text-right tabular-nums text-[#99A1B7]">
                  {projectedTotals.clicks > 0 ? abbr(projectedTotals.clicks) : '—'}
                </td>
                <VarianceCell
                  actual={totals.clicks > 0 ? totals.clicks : null}
                  projected={projectedTotals.clicks}
                />
                <td className="px-3 py-2 border border-[#E1E3EA] text-right tabular-nums text-[#4B5675]">
                  {totals.spend > 0 ? abbr(totals.spend) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
