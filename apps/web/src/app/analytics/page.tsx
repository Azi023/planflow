'use client';

import { useEffect, useState } from 'react';
import {
  fetchAccuracyHeatmap,
  fetchAccuracyDetail,
  fetchMonthlyTrend,
  fetchBenchmarkSuggestions,
  acceptBenchmarkSuggestion,
  rejectBenchmarkSuggestion,
  computeBenchmarkSuggestions,
} from '@/lib/api';
import type {
  AccuracyHeatmap,
  AccuracyDetail,
  HeatmapCell,
  BenchmarkSuggestion,
  MonthlyTrendEntry,
} from '@/lib/types';
import { PLATFORM_LABEL, OBJECTIVE_LABEL } from '@/lib/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { Toast } from '@/components/Toast';
import { PageHeader } from '@/components/PageHeader';

// ─── Score → color mapping ──────────────────────────────────────────────────

function scoreColor(score: number, sampleSize: number): string {
  if (sampleSize === 0) return 'bg-[#F1F5F9] text-[#94A3B8]';
  if (score >= 75) return 'bg-[#DCFCE7] text-[#15803D]';
  if (score >= 50) return 'bg-[#FEF9C3] text-[#A16207]';
  return 'bg-[#FEE2E2] text-[#B91C1C]';
}

function scoreBorder(score: number, sampleSize: number): string {
  if (sampleSize === 0) return 'border-[#E2E8F0]';
  if (score >= 75) return 'border-[#86EFAC]';
  if (score >= 50) return 'border-[#FDE047]';
  return 'border-[#FCA5A5]';
}

function TrendIcon({ trend }: { trend: HeatmapCell['trend'] }) {
  if (trend === 'improving')
    return <span className="text-green-600 ml-1">↑</span>;
  if (trend === 'declining')
    return <span className="text-red-500 ml-1">↓</span>;
  if (trend === 'stable')
    return <span className="text-gray-400 ml-1">→</span>;
  return null;
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  cell,
  onClose,
}: {
  cell: HeatmapCell;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<AccuracyDetail | null>(null);
  const [trend, setTrend] = useState<MonthlyTrendEntry[]>([]);

  useEffect(() => {
    fetchAccuracyDetail(cell.platform, cell.objective).then(setDetail).catch(() => null);
    fetchMonthlyTrend(cell.platform, cell.objective).then(setTrend).catch(() => null);
  }, [cell.platform, cell.objective]);

  const fmtNum = (n: number | null | undefined, decimals = 2) =>
    n == null ? '—' : Number(n).toFixed(decimals);

  const deviationLabel = (pct: number | null) => {
    if (pct == null) return null;
    const abs = Math.abs(pct);
    const dir = pct > 0 ? 'higher' : 'lower';
    const color = abs > 15 ? 'text-red-600' : abs > 5 ? 'text-amber-600' : 'text-green-600';
    return <span className={`font-medium ${color}`}>{abs}% {dir} than benchmark</span>;
  };

  const platformLabel = PLATFORM_LABEL[cell.platform] ?? cell.platform;
  const objectiveLabel = OBJECTIVE_LABEL[cell.objective] ?? cell.objective;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end">
      <div className="bg-white h-full w-full max-w-xl overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E1E3EA] bg-[#F8F9FF] sticky top-0">
          <div>
            <h2 className="font-semibold text-[#071437] text-base">{platformLabel}</h2>
            <p className="text-sm text-[#4B5675]">{objectiveLabel} · Accuracy Detail</p>
          </div>
          <button
            onClick={onClose}
            className="text-[#99A1B7] hover:text-[#071437] transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {!detail ? (
          <div className="flex-1 flex items-center justify-center text-[#99A1B7]">Loading…</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Score summary */}
            <div
              className={`rounded-lg border p-4 ${scoreColor(cell.score, cell.sampleSize)} ${scoreBorder(cell.score, cell.sampleSize)}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Accuracy</span>
                <span className="text-2xl font-bold">
                  {cell.sampleSize === 0 ? '—' : `${cell.score}%`}
                </span>
              </div>
              <p className="text-xs mt-1 opacity-75">{cell.sampleSize} data point{cell.sampleSize !== 1 ? 's' : ''}</p>
            </div>

            {/* CPM comparison */}
            <div className="rounded-lg border border-[#E1E3EA] p-4">
              <h3 className="text-sm font-semibold text-[#071437] mb-3">CPM (Cost Per Mille)</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[#99A1B7] text-xs mb-1">Benchmark Range</p>
                  <p className="font-medium text-[#071437]">
                    {fmtNum(detail.benchmarkCpmLow)} – {fmtNum(detail.benchmarkCpmHigh)}
                  </p>
                </div>
                <div>
                  <p className="text-[#99A1B7] text-xs mb-1">Actual Average</p>
                  <p className="font-medium text-[#071437]">{fmtNum(detail.actualAvgCpm)}</p>
                </div>
              </div>
              {detail.cpmDeviationPct != null && (
                <p className="text-xs mt-2">{deviationLabel(detail.cpmDeviationPct)}</p>
              )}
            </div>

            {/* CPC comparison */}
            {(detail.benchmarkCpcLow || detail.actualAvgCpc) && (
              <div className="rounded-lg border border-[#E1E3EA] p-4">
                <h3 className="text-sm font-semibold text-[#071437] mb-3">CPC (Cost Per Click)</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#99A1B7] text-xs mb-1">Benchmark Range</p>
                    <p className="font-medium text-[#071437]">
                      {fmtNum(detail.benchmarkCpcLow)} – {fmtNum(detail.benchmarkCpcHigh)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#99A1B7] text-xs mb-1">Actual Average</p>
                    <p className="font-medium text-[#071437]">{fmtNum(detail.actualAvgCpc)}</p>
                  </div>
                </div>
                {detail.cpcDeviationPct != null && (
                  <p className="text-xs mt-2">{deviationLabel(detail.cpcDeviationPct)}</p>
                )}
              </div>
            )}

            {/* Monthly trend */}
            {trend.length > 0 && (
              <div className="rounded-lg border border-[#E1E3EA] p-4">
                <h3 className="text-sm font-semibold text-[#071437] mb-3">Monthly CPM Trend</h3>
                <div className="space-y-1.5">
                  {trend.map((t) => {
                    const max = Math.max(...trend.map((x) => x.avgCpm ?? 0));
                    const pct = max > 0 && t.avgCpm ? (t.avgCpm / max) * 100 : 0;
                    return (
                      <div key={t.month} className="flex items-center gap-2 text-sm">
                        <span className="w-20 text-[#99A1B7] text-xs">{t.monthName.slice(0, 3)}</span>
                        <div className="flex-1 bg-[#F1F5F9] rounded-full h-2">
                          <div
                            className="bg-[#1B84FF] h-2 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-xs text-[#4B5675]">
                          {t.avgCpm ? t.avgCpm.toFixed(2) : '—'}
                        </span>
                        <span className="text-xs text-[#99A1B7]">({t.count})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent entries */}
            {detail.recentEntries.length > 0 && (
              <div className="rounded-lg border border-[#E1E3EA] p-4">
                <h3 className="text-sm font-semibold text-[#071437] mb-3">Recent Actuals</h3>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#99A1B7] border-b border-[#E1E3EA]">
                      <th className="text-left pb-1.5">Period</th>
                      <th className="text-right pb-1.5">CPM</th>
                      <th className="text-right pb-1.5">CPC</th>
                      <th className="text-right pb-1.5">Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.recentEntries.map((e, i) => (
                      <tr key={i} className="border-b border-[#F1F5F9] last:border-0">
                        <td className="py-1.5 text-[#4B5675]">{e.period ?? '—'}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtNum(e.actualCpm)}</td>
                        <td className="py-1.5 text-right tabular-nums">{fmtNum(e.actualCpc)}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {e.spend ? `${(e.spend / 1000).toFixed(0)}K` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Suggestions Panel ────────────────────────────────────────────────────────

function SuggestionsSection({
  suggestions,
  onAccept,
  onReject,
}: {
  suggestions: BenchmarkSuggestion[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (!suggestions.length) return null;

  const fieldLabel: Record<string, string> = {
    cpmLow: 'CPM Low', cpmHigh: 'CPM High',
    cpcLow: 'CPC Low', cpcHigh: 'CPC High',
    cprLow: 'CPR Low', cprHigh: 'CPR High',
  };

  return (
    <div className="bg-white border border-[#E1E3EA] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-amber-400" />
        <h2 className="font-semibold text-[#071437] text-sm">
          Auto-Tune Suggestions ({suggestions.length})
        </h2>
        <span className="text-xs text-[#99A1B7] ml-1">Benchmarks with &gt;15% deviation from actuals</span>
      </div>

      <div className="space-y-2.5">
        {suggestions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#071437] truncate">
                {PLATFORM_LABEL[s.benchmark?.platform ?? ''] ?? s.benchmark?.platform ?? s.benchmarkId}
                {s.benchmark?.objective && (
                  <span className="text-[#99A1B7] font-normal">
                    {' '}· {OBJECTIVE_LABEL[s.benchmark.objective] ?? s.benchmark.objective}
                  </span>
                )}
              </p>
              <p className="text-xs text-[#4B5675] mt-0.5">
                {fieldLabel[s.fieldName] ?? s.fieldName}: {s.currentValue ?? '—'} →{' '}
                <span className="font-semibold text-amber-700">{Number(s.suggestedValue).toFixed(2)}</span>
                <span className="ml-2 text-[#99A1B7]">
                  ({s.deviationPct > 0 ? '+' : ''}{s.deviationPct}% deviation, n={s.sampleCount})
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => onAccept(s.id)}
                className="text-xs font-medium px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onReject(s.id)}
                className="text-xs font-medium px-3 py-1.5 border border-[#E1E3EA] text-[#4B5675] rounded-md hover:bg-[#F1F5F9] transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [heatmap, setHeatmap] = useState<AccuracyHeatmap | null>(null);
  const [suggestions, setSuggestions] = useState<BenchmarkSuggestion[]>([]);
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetchAccuracyHeatmap(),
      fetchBenchmarkSuggestions(),
    ])
      .then(([h, s]) => {
        setHeatmap(h);
        setSuggestions(s);
      })
      .catch(() => setToast({ msg: 'Failed to load analytics', type: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleAccept = async (id: string) => {
    try {
      await acceptBenchmarkSuggestion(id);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setToast({ msg: 'Suggestion accepted and benchmark updated', type: 'success' });
    } catch {
      setToast({ msg: 'Failed to accept suggestion', type: 'error' });
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectBenchmarkSuggestion(id);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setToast({ msg: 'Suggestion dismissed', type: 'success' });
    } catch {
      setToast({ msg: 'Failed to reject suggestion', type: 'error' });
    }
  };

  const handleComputeSuggestions = async () => {
    try {
      const result = await computeBenchmarkSuggestions();
      setToast({ msg: `Found ${result.created} new suggestions`, type: 'success' });
      loadData();
    } catch {
      setToast({ msg: 'Failed to compute suggestions', type: 'error' });
    }
  };

  const OBJECTIVE_ORDER = ['awareness', 'engagement', 'traffic', 'leads'];

  // Build a set of all platforms that have any actuals data
  const platformsWithData = new Set(
    (heatmap?.cells ?? [])
      .filter((c) => c.sampleSize > 0)
      .map((c) => c.platform),
  );

  // Show all platforms, sorted: data first, then rest
  const allPlatforms = heatmap
    ? [...heatmap.platforms].sort((a, b) => {
        const aHas = platformsWithData.has(a) ? 0 : 1;
        const bHas = platformsWithData.has(b) ? 0 : 1;
        return aHas - bHas || a.localeCompare(b);
      })
    : [];

  const allObjectives = heatmap
    ? [...heatmap.objectives].sort(
        (a, b) => OBJECTIVE_ORDER.indexOf(a) - OBJECTIVE_ORDER.indexOf(b),
      )
    : [];

  const cellMap = new Map(
    (heatmap?.cells ?? []).map((c) => [`${c.platform}|${c.objective}`, c]),
  );

  return (
    <>
      <PageHeader
        title="Benchmark Analytics"
        subtitle="Accuracy of projections vs actuals · Click any cell for details"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Analytics' }]}
        action={
          user?.role === 'admin' ? (
            <button
              onClick={handleComputeSuggestions}
              className="text-sm font-medium px-4 py-2 bg-[#1B84FF] text-white rounded-lg hover:bg-[#056EE9] transition-colors"
            >
              Refresh Suggestions
            </button>
          ) : undefined
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {selectedCell && (
        <DetailPanel cell={selectedCell} onClose={() => setSelectedCell(null)} />
      )}

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-[#4B5675]">
          <span className="font-medium">Score Legend:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#DCFCE7] border border-[#86EFAC]" />
            ≥75% Accurate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#FEF9C3] border border-[#FDE047]" />
            50–74% Moderate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#FEE2E2] border border-[#FCA5A5]" />
            &lt;50% Inaccurate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#F1F5F9] border border-[#E2E8F0]" />
            No data
          </span>
        </div>

        {/* Auto-tuning suggestions */}
        {suggestions.length > 0 && (
          <SuggestionsSection
            suggestions={suggestions}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        )}

        {/* Insufficient data banner — shown when all cells are below the minimum sample threshold */}
        {!loading && heatmap && suggestions.length === 0 && heatmap.cells.every((c) => c.sampleSize < 5) && (
          <div className="bg-[#FFF8DD] border border-[#F6B100]/20 rounded-lg px-4 py-3 text-sm text-[#4B5675]">
            <span className="font-medium text-[#F6B100]">Insufficient data</span> — Analytics accuracy improves as you log campaign actuals. Need 5+ actuals per platform/objective combination for heatmap scores, and 15+ for benchmark suggestions.
          </div>
        )}

        {/* Heatmap */}
        <div className="bg-white border border-[#E1E3EA] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E1E3EA]">
            <h2 className="font-semibold text-[#071437] text-sm">Projection Accuracy Heatmap</h2>
            <p className="text-xs text-[#99A1B7] mt-0.5">Platforms × Objectives · n = sample size</p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[#99A1B7] text-sm">Loading heatmap…</div>
          ) : !heatmap || allPlatforms.length === 0 ? (
            <div className="p-12 text-center text-[#99A1B7] text-sm">No benchmark data available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F8F9FF]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#99A1B7] uppercase tracking-wide border-b border-[#E1E3EA] w-44">
                      Platform
                    </th>
                    {allObjectives.map((obj) => (
                      <th
                        key={obj}
                        className="px-3 py-3 text-xs font-semibold text-[#99A1B7] uppercase tracking-wide border-b border-[#E1E3EA] text-center"
                      >
                        {OBJECTIVE_LABEL[obj] ?? obj}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPlatforms.map((platform) => (
                    <tr key={platform} className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8F9FF]">
                      <td className="px-5 py-3 font-medium text-[#071437] text-sm">
                        {PLATFORM_LABEL[platform] ?? platform}
                      </td>
                      {allObjectives.map((objective) => {
                        const cell = cellMap.get(`${platform}|${objective}`);
                        if (!cell) {
                          return (
                            <td key={objective} className="px-3 py-3 text-center">
                              <span className="text-[#CBD5E1] text-xs">—</span>
                            </td>
                          );
                        }
                        if (!cell.hasData) {
                          return (
                            <td key={objective} className="px-3 py-2 text-center">
                              <button
                                onClick={() => setSelectedCell(cell)}
                                className="inline-flex flex-col items-center justify-center w-20 h-14 rounded-lg border border-[#E2E8F0] bg-[#F9F9F9] hover:shadow-sm transition-shadow cursor-pointer"
                              >
                                <span className="text-sm font-medium text-[#CBD5E1] leading-none">—</span>
                                <span className="text-[10px] text-[#CBD5E1] mt-1">
                                  {cell.sampleSize === 0 ? 'No data' : `n=${cell.sampleSize}`}
                                </span>
                              </button>
                            </td>
                          );
                        }
                        return (
                          <td key={objective} className="px-3 py-2 text-center">
                            <button
                              onClick={() => setSelectedCell(cell)}
                              className={`inline-flex flex-col items-center justify-center w-20 h-14 rounded-lg border ${scoreColor(cell.score, cell.sampleSize)} ${scoreBorder(cell.score, cell.sampleSize)} hover:shadow-sm transition-shadow cursor-pointer`}
                            >
                              <span className="text-base font-bold leading-none">
                                {cell.sampleSize === 0 ? '—' : `${cell.score}%`}
                              </span>
                              <span className="text-[10px] opacity-75 mt-0.5">
                                n={cell.sampleSize}
                                <TrendIcon trend={cell.trend} />
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Insight callouts */}
        {heatmap && (
          <div className="grid grid-cols-3 gap-4">
            {(() => {
              const withData = heatmap.cells.filter((c) => c.sampleSize > 0);
              const accurate = withData.filter((c) => c.score >= 75).length;
              const total = withData.length;
              const avgScore =
                withData.length > 0
                  ? Math.round(withData.reduce((s, c) => s + c.score, 0) / withData.length)
                  : 0;
              const totalSamples = heatmap.cells.reduce((s, c) => s + c.sampleSize, 0);

              return (
                <>
                  <div className="bg-white border border-[#E1E3EA] rounded-xl p-5">
                    <p className="text-xs text-[#99A1B7] uppercase tracking-wide">Avg Accuracy</p>
                    <p className="text-3xl font-bold text-[#071437] mt-1">{avgScore}%</p>
                    <p className="text-xs text-[#4B5675] mt-1">Across {total} platform/objective combinations</p>
                  </div>
                  <div className="bg-white border border-[#E1E3EA] rounded-xl p-5">
                    <p className="text-xs text-[#99A1B7] uppercase tracking-wide">High Accuracy</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">{accurate}/{total}</p>
                    <p className="text-xs text-[#4B5675] mt-1">Combinations with ≥75% accuracy score</p>
                  </div>
                  <div className="bg-white border border-[#E1E3EA] rounded-xl p-5">
                    <p className="text-xs text-[#99A1B7] uppercase tracking-wide">Data Points</p>
                    <p className="text-3xl font-bold text-[#1B84FF] mt-1">{totalSamples}</p>
                    <p className="text-xs text-[#4B5675] mt-1">Actual campaign results recorded</p>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </>
  );
}
