'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { fetchBenchmarks, updateBenchmark } from '@/lib/api';
import type { AudienceType, Benchmark, Objective } from '@/lib/types';
import { OBJECTIVE_LABEL, PLATFORM_LABEL } from '@/lib/types';
import { fmtBenchmarkRange, fmtCost } from '@/lib/format';

// ─── Column definitions ───────────────────────────────────────────────────────

type NumericKey =
  | 'cpm' | 'cpr' | 'cpe' | 'cpc'
  | 'cpv2s' | 'cpvTv' | 'cplv' | 'cpl' | 'pageLike';

type MetricCol =
  | { key: NumericKey; label: string; decimals: number; type: 'range' }
  | { key: 'ctr';       label: string; decimals: number; type: 'ctr'  }
  | { key: 'frequency'; label: string;                   type: 'text' };

const METRIC_COLS: MetricCol[] = [
  { key: 'cpm',       label: 'CPM',      decimals: 2, type: 'range' },
  { key: 'cpr',       label: 'CPR',      decimals: 2, type: 'range' },
  { key: 'cpe',       label: 'CPE',      decimals: 2, type: 'range' },
  { key: 'cpc',       label: 'CPC',      decimals: 2, type: 'range' },
  { key: 'ctr',       label: 'CTR',      decimals: 2, type: 'ctr'   },
  { key: 'frequency', label: 'Freq',                  type: 'text'  },
  { key: 'cpv2s',     label: 'CPV 2s',   decimals: 2, type: 'range' },
  { key: 'cpvTv',     label: 'CPV TV',   decimals: 2, type: 'range' },
  { key: 'cplv',      label: 'CPLV',     decimals: 2, type: 'range' },
  { key: 'cpl',       label: 'CPL',      decimals: 2, type: 'range' },
  { key: 'pageLike',  label: 'Per Like', decimals: 2, type: 'range' },
];

const USD_PLATFORMS = new Set([
  'gdn', 'youtube_video', 'youtube_bumper', 'search', 'demand_gen', 'perf_max',
]);

// ─── EditRangeCell ─────────────────────────────────────────────────────────────

interface EditRangeCellProps {
  loVal: number | string | null;
  hiVal: number | string | null;
  decimals: number;
  isCtr?: boolean;
  onSave: (lo: string, hi: string) => void;
}

function EditRangeCell({ loVal, hiVal, decimals, isCtr = false, onSave }: EditRangeCellProps) {
  const [editing, setEditing] = useState(false);
  const [draftLo, setDraftLo] = useState('');
  const [draftHi, setDraftHi] = useState('');
  const loRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    // Edit in raw form — user edits the fraction, not the percentage
    setDraftLo(fmtCost(loVal, 6));
    setDraftHi(fmtCost(hiVal, 6));
    setEditing(true);
  };

  useEffect(() => {
    if (editing) loRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    onSave(draftLo, draftHi);
  };

  const display = fmtBenchmarkRange(loVal, hiVal, decimals, isCtr);

  if (!editing) {
    return (
      <span
        className="cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#EEF6FF] inline-block min-w-[48px] min-h-[20px] tabular-nums"
        onDoubleClick={startEdit}
        title="Double-click to edit (raw values)"
      >
        {display === '—' ? <span className="text-[#C9CDDA] text-xs">—</span> : display}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      <input
        ref={loRef}
        value={draftLo}
        onChange={(e) => setDraftLo(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const next = e.currentTarget.nextElementSibling?.nextElementSibling as HTMLInputElement;
            next?.focus();
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-16 border border-[#1B84FF] rounded px-1 py-0.5 text-xs focus:outline-none"
        placeholder="lo"
      />
      <span className="text-[#C9CDDA] text-xs">–</span>
      <input
        value={draftHi}
        onChange={(e) => setDraftHi(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-16 border border-[#1B84FF] rounded px-1 py-0.5 text-xs focus:outline-none"
        placeholder="hi"
      />
    </div>
  );
}

// ─── EditTextCell ─────────────────────────────────────────────────────────────

function EditTextCell({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { setEditing(false); if (draft !== (value ?? '')) onSave(draft); };

  const display =
    value === 'Can be vary' ? 'Varies' :
    value === 'N/A' || value === '' || value == null ? '—' :
    value;

  if (!editing) {
    return (
      <span
        className="cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#EEF6FF] inline-block min-w-[36px] min-h-[20px]"
        onDoubleClick={() => { setDraft(value ?? ''); setEditing(true); }}
        title="Double-click to edit"
      >
        {display === '—' ? <span className="text-[#C9CDDA] text-xs">—</span> : display}
      </span>
    );
  }

  return (
    <input
      ref={ref}
      className="w-20 border border-[#1B84FF] rounded px-1 py-0.5 text-xs focus:outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { setEditing(false); setDraft(value ?? ''); }
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const OBJECTIVES_ORDER: Objective[] = ['awareness', 'engagement', 'traffic', 'leads'];

const OBJECTIVE_ACCENT: Record<Objective, { border: string; bg: string; text: string }> = {
  awareness:  { border: '#1B84FF', bg: '#EEF6FF', text: '#1B84FF' },
  engagement: { border: '#17C653', bg: '#DFFFEA', text: '#17C653' },
  traffic:    { border: '#F6B100', bg: '#FFF8DD', text: '#B07D00' },
  leads:      { border: '#F8285A', bg: '#FFEEF3', text: '#F8285A' },
};

export default function BenchmarkTable() {
  const [audienceType, setAudienceType] = useState<AudienceType>('mass');
  const [rows, setRows] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBenchmarks({ audienceType });
      setRows(data);
    } finally {
      setLoading(false);
    }
  }, [audienceType]);

  useEffect(() => { load(); }, [load]);

  const handleRangeSave = useCallback(
    async (id: string, loKey: string, hiKey: string, rawLo: string, rawHi: string) => {
      const lo = rawLo === '' ? null : parseFloat(rawLo);
      const hi = rawHi === '' ? null : parseFloat(rawHi);
      setSaving(id);
      try {
        const updated = await updateBenchmark(id, {
          [loKey]: !rawLo || isNaN(lo as number) ? null : lo,
          [hiKey]: !rawHi || isNaN(hi as number) ? null : hi,
        });
        setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      } finally {
        setSaving(null);
      }
    },
    [],
  );

  const handleTextSave = useCallback(
    async (id: string, field: string, val: string) => {
      setSaving(id);
      try {
        const updated = await updateBenchmark(id, { [field]: val || null });
        setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      } finally {
        setSaving(null);
      }
    },
    [],
  );

  const grouped = OBJECTIVES_ORDER.map((obj) => ({
    objective: obj,
    items: rows.filter((r) => r.objective === obj),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F1F4]">
        <div>
          <h2 className="text-base font-semibold text-[#071437]">KPI Benchmarks</h2>
          <p className="text-xs text-[#99A1B7] mt-0.5">
            Double-click any value to edit · CTR shown as % · CPV/CPM/CPC in platform currency
          </p>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex gap-3 text-xs text-[#99A1B7]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EEF6FF] border border-[#1B84FF]/40" />LKR
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FFF8DD] border border-[#F6B100]/40" />USD
            </span>
          </div>
          {/* Pill toggle */}
          <div className="flex rounded-lg border border-[#E1E3EA] overflow-hidden bg-[#F9F9F9]">
            {(['mass', 'niche'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAudienceType(t)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  audienceType === t
                    ? 'bg-[#1B84FF] text-white'
                    : 'text-[#4B5675] hover:text-[#071437]'
                }`}
              >
                {t === 'mass' ? 'Local-Mass (1M+)' : 'Local-Niche (<1M)'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-[#99A1B7] text-sm gap-2">
          <div className="w-4 h-4 border-2 border-[#1B84FF]/30 border-t-[#1B84FF] rounded-full animate-spin" />
          Loading benchmarks…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E1E3EA]">
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-36 sticky left-0 bg-[#F9F9F9] border-r border-[#E1E3EA]">
                  Platform
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-28">Min Duration</th>
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-24">Daily Budget</th>
                <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-12">Cur</th>
                {METRIC_COLS.map((m) => (
                  <th key={m.key} className="px-3 py-2.5 text-center text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-28">
                    {m.label}
                    {m.type === 'ctr' && (
                      <span className="ml-1 text-[9px] font-normal text-[#99A1B7]">(→%)</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ objective, items }) => {
                const accent = OBJECTIVE_ACCENT[objective] ?? OBJECTIVE_ACCENT.awareness;
                return (
                <Fragment key={`obj-${objective}`}>
                  <tr>
                    <td
                      colSpan={4 + METRIC_COLS.length}
                      className="px-3 py-2 sticky left-0"
                      style={{ background: accent.bg, borderTop: `1px solid ${accent.border}20`, borderBottom: `1px solid ${accent.border}20` }}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-[3px] h-4 rounded-full inline-block" style={{ background: accent.border }} />
                        <span className="text-xs font-semibold" style={{ color: accent.text }}>
                          {OBJECTIVE_LABEL[objective] ?? objective}
                        </span>
                      </span>
                    </td>
                  </tr>
                  {items.map((row) => {
                    const isUsd = USD_PLATFORMS.has(row.platform) || row.currency === 'USD';
                    const rowBg = isUsd ? '#FFFBF0' : '#FFFFFF';
                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-[#F1F1F4] transition-colors ${
                          saving === row.id ? 'opacity-60' : ''
                        }`}
                        style={{ backgroundColor: rowBg }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isUsd ? '#FFF3CC' : '#F9F9F9')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = rowBg)}
                      >
                        <td className="px-3 py-1.5 font-medium text-[#071437] sticky left-0 border-r border-[#F1F1F4] whitespace-nowrap" style={{ backgroundColor: rowBg }}>
                          {PLATFORM_LABEL[row.platform] ?? row.platform}
                          {saving === row.id && (
                            <span className="ml-1 text-[#1B84FF] text-[10px]">↻</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-[#4B5675] whitespace-nowrap">
                          {row.minDuration ?? '—'}
                        </td>
                        <td className="px-3 py-1.5 text-[#4B5675] whitespace-nowrap">
                          {row.minDailyBudget ?? '—'}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              isUsd
                                ? 'bg-[#FFF8DD] text-[#B07D00] border border-[#F6B100]/30'
                                : 'bg-[#EEF6FF] text-[#1B84FF] border border-[#1B84FF]/20'
                            }`}
                          >
                            {row.currency}
                          </span>
                        </td>

                        {METRIC_COLS.map((m) => {
                          if (m.type === 'text') {
                            return (
                              <td key={`${row.id}-freq`} className="px-2 py-1.5 text-center text-[#4B5675]">
                                <EditTextCell
                                  value={row.frequency}
                                  onSave={(val) => handleTextSave(row.id, 'frequency', val)}
                                />
                              </td>
                            );
                          }

                          const loKey = `${m.key}Low` as keyof Benchmark;
                          const hiKey = `${m.key}High` as keyof Benchmark;
                          const isCtr = m.type === 'ctr';

                          return (
                            <td key={`${row.id}-${m.key}`} className="px-2 py-1.5 text-center text-[#4B5675]">
                              <EditRangeCell
                                loVal={row[loKey] as number | string | null}
                                hiVal={row[hiKey] as number | string | null}
                                decimals={m.decimals}
                                isCtr={isCtr}
                                onSave={(lo, hi) =>
                                  handleRangeSave(
                                    row.id,
                                    loKey as string,
                                    hiKey as string,
                                    lo,
                                    hi,
                                  )
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
