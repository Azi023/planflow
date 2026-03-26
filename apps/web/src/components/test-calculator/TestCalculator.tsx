'use client';

import { useState } from 'react';
import { calculateKpis } from '@/lib/api';
import type { CalculatedKpis, KpiRange } from '@/lib/types';
import { OBJECTIVES, PLATFORMS, PLATFORM_LABEL } from '@/lib/types';
import { fmtKpiRange, fullRange, fmtFreqRange, fmtCtrPct, applyBufferToKpis } from '@/lib/format';

// ─── Range display with tooltip ──────────────────────────────────────────────

function KpiRangeCell({
  low,
  high,
  format = 'km',
}: {
  low: number | null;
  high: number | null;
  format?: 'km' | 'freq' | 'ctr';
}) {
  if (low == null && high == null) return <span className="text-[#99A1B7]">N/A</span>;

  let display: string;
  if (format === 'freq') display = fmtFreqRange(low, high);
  else if (format === 'ctr') {
    const lo = low != null ? fmtCtrPct(low) : null;
    const hi = high != null ? fmtCtrPct(high) : null;
    if (!lo && !hi) display = '—';
    else if (!hi) display = `${lo}+`;
    else if (!lo) display = `< ${hi}`;
    else display = `${lo} – ${hi}`;
  } else {
    display = fmtKpiRange(low, high);
  }

  return (
    <span
      className="font-bold text-[#071437] tabular-nums cursor-default text-base leading-tight"
      title={fullRange(low, high)}
    >
      {display}
    </span>
  );
}

const KPI_ROWS = [
  { label: 'Impressions',            key: 'impressions',      format: 'km'   as const },
  { label: 'Reach',                  key: 'reach',            format: 'km'   as const },
  { label: 'Clicks',                 key: 'clicks',           format: 'km'   as const },
  { label: 'Engagements',            key: 'engagements',      format: 'km'   as const },
  { label: 'Video Views (2s)',        key: 'videoViews2s',     format: 'km'   as const },
  { label: 'Video Views (TrueView)', key: 'videoViewsTv',     format: 'km'   as const },
  { label: 'Landing Page Views',     key: 'landingPageViews', format: 'km'   as const },
  { label: 'Leads',                  key: 'leads',            format: 'km'   as const },
  { label: 'Frequency',              key: 'frequency',        format: 'freq' as const },
  { label: 'CTR',                    key: 'ctr',              format: 'ctr'  as const },
] as const;

export default function TestCalculator() {
  const [open, setOpen] = useState(true);
  const [platform, setPlatform] = useState('meta_ig');
  const [objective, setObjective] = useState('awareness');
  const [audienceType, setAudienceType] = useState<'mass' | 'niche'>('mass');
  const [budget, setBudget] = useState('');
  const [currency, setCurrency] = useState('LKR');
  const [bufferPct, setBufferPct] = useState('12');
  const [result, setResult] = useState<CalculatedKpis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCalculate = async () => {
    const budgetNum = parseFloat(budget);
    if (!budgetNum || budgetNum <= 0) { setError('Enter a valid budget'); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const raw = await calculateKpis({ platform, objective, audienceType, budget: budgetNum, currency });

      // Currency mismatch check
      if (raw.benchmark.currency !== currency) {
        setError(
          `Currency mismatch: this platform's benchmarks use ${raw.benchmark.currency} pricing. ` +
          `Enter your budget in ${raw.benchmark.currency}, or switch the currency above.`
        );
        return;
      }

      const buffer = parseFloat(bufferPct) || 0;
      setResult(applyBufferToKpis(raw, buffer));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calculation failed');
    } finally {
      setLoading(false);
    }
  };

  const bufferNum = parseFloat(bufferPct) || 0;

  const inputClass = "w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors";
  const labelClass = "block text-[13px] font-medium text-[#4B5675] mb-1.5";

  return (
    <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-[#F1F1F4] hover:bg-[#F9F9F9] transition-colors"
      >
        <div className="text-left">
          <h2 className="text-base font-semibold text-[#071437]">Test Calculator</h2>
          <p className="text-xs text-[#99A1B7] mt-0.5">Quick KPI verification for a given budget</p>
        </div>
        <span className="text-[#99A1B7] text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="flex gap-0 divide-x divide-[#F1F1F4]">
          {/* Left: inputs */}
          <div className="flex-none w-72 p-6 space-y-4">
            {/* Audience toggle */}
            <div>
              <label className={labelClass}>Audience Type</label>
              <div className="flex rounded-lg border border-[#E1E3EA] overflow-hidden bg-[#F9F9F9]">
                {(['mass', 'niche'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setAudienceType(t)}
                    className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                      audienceType === t
                        ? 'bg-[#1B84FF] text-white'
                        : 'text-[#4B5675] hover:text-[#071437]'
                    }`}
                  >
                    {t === 'mass' ? 'Mass (1M+)' : 'Niche (<1M)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Objective</label>
              <select value={objective} onChange={(e) => setObjective(e.target.value)} className={inputClass}>
                {OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)} className={inputClass}>
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Budget</label>
              <div className="flex gap-2">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="border border-[#E1E3EA] rounded-[6px] px-2 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] transition-colors w-20"
                >
                  <option value="LKR">LKR</option>
                  <option value="USD">USD</option>
                </select>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 250000"
                  className="flex-1 border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>
                Buffer %{' '}
                <span
                  className="ml-0.5 text-[#99A1B7] cursor-help"
                  title="Reduces HIGH estimates to avoid overpromising. Low estimate is unchanged."
                >ⓘ</span>
              </label>
              <input
                type="number"
                value={bufferPct}
                onChange={(e) => setBufferPct(e.target.value)}
                min={0} max={50} step={1}
                className={inputClass}
              />
            </div>

            {error && (
              <div className={`text-xs rounded-[6px] p-3 ${
                error.includes('mismatch') || error.includes('USD')
                  ? 'text-[#B07D00] bg-[#FFF8DD] border border-[#F6B100]/30'
                  : 'text-[#F8285A] bg-[#FFEEF3] border border-[#F8285A]/20'
              }`}>
                {error}
              </div>
            )}

            <button
              onClick={handleCalculate}
              disabled={loading}
              className="w-full bg-[#1B84FF] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#056EE9] active:bg-[#0458C8] transition-colors disabled:opacity-60 shadow-sm flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {loading ? 'Calculating…' : 'Calculate KPIs'}
            </button>
          </div>

          {/* Right: results */}
          <div className="flex-1 p-6">
            {!result ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
                <div className="w-12 h-12 rounded-xl bg-[#F9F9F9] border border-[#E1E3EA] flex items-center justify-center text-xl">
                  📊
                </div>
                <p className="text-sm text-[#4B5675] font-medium">Select options and calculate</p>
                <p className="text-xs text-[#99A1B7]">Results will appear here</p>
              </div>
            ) : (
              <>
                {/* Matched benchmark card */}
                <div className="mb-4 p-3 bg-[#DFFFEA] rounded-[6px] border border-[#17C653]/30 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-[#17C653] font-semibold mb-0.5">Matched Benchmark</p>
                    <p className="text-xs text-[#4B5675]">
                      {PLATFORM_LABEL[result.benchmark.platform] ?? result.benchmark.platform} ·{' '}
                      {result.benchmark.objective} · {result.benchmark.audienceType} ·{' '}
                      <span className="font-medium">{result.benchmark.currency}</span>
                    </p>
                    {result.benchmark.minDuration && (
                      <p className="text-xs text-[#4B5675] mt-0.5">Min duration: {result.benchmark.minDuration}</p>
                    )}
                  </div>
                  {bufferNum > 0 && (
                    <span className="text-[10px] bg-[#FFF8DD] text-[#B07D00] border border-[#F6B100]/30 font-semibold px-2 py-1 rounded whitespace-nowrap shrink-0">
                      {bufferNum}% buffer
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {KPI_ROWS.map(({ label, key, format }) => {
                    const kpi = result[key as keyof CalculatedKpis] as KpiRange | undefined;
                    if (!kpi) return null;
                    return (
                      <div key={key} className="bg-[#F9F9F9] rounded-[6px] p-3 border border-[#F1F1F4]">
                        <p className="text-[11px] text-[#99A1B7] font-medium mb-1.5">{label}</p>
                        <KpiRangeCell low={kpi.low} high={kpi.high} format={format} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
