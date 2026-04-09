'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchBenchmarks,
  updateBenchmark,
  importBenchmarksCsv,
  fetchConfidenceLevels,
  fetchBenchmarkSuggestions,
  fetchBenchmarkHistory,
} from '@/lib/api';
import type {
  AudienceType, Benchmark, Objective,
  ConfidenceScore, BenchmarkSuggestion, BenchmarkHistoryEntry,
} from '@/lib/types';
import { OBJECTIVE_LABEL, PLATFORM_LABEL } from '@/lib/types';
import { fmtBenchmarkRange, fmtCost } from '@/lib/format';
import { Toast } from '@/components/Toast';
import { useAuth } from '@/components/auth/AuthProvider';

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

// ─── Confidence Badge ────────────────────────────────────────────────────────

function ConfidenceBadge({ level, count }: { level: string; count: number }) {
  if (level === 'high') {
    return (
      <span
        title={`High confidence (${count} actuals)`}
        className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200"
      >
        ● High
      </span>
    );
  }
  if (level === 'medium') {
    return (
      <span
        title={`Medium confidence (${count} actuals)`}
        className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200"
      >
        ◑ Med
      </span>
    );
  }
  if (level === 'low') {
    return (
      <span
        title={`Low confidence (${count} actuals)`}
        className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200"
      >
        ○ Low
      </span>
    );
  }
  return null;
}

// ─── History Panel ─────────────────────────────────────────────────────────────

function HistoryPanel({
  benchmark,
  onClose,
}: {
  benchmark: Benchmark;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<BenchmarkHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBenchmarkHistory(benchmark.id)
      .then(setHistory)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [benchmark.id]);

  const sourceLabel: Record<string, string> = {
    manual: 'Manual edit',
    auto_tune: 'Auto-tune',
    csv_import: 'CSV import',
  };

  const sourceBadge = (source: string) => {
    const cls =
      source === 'auto_tune'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : source === 'csv_import'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-gray-50 text-gray-600 border-gray-200';
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
        {sourceLabel[source] ?? source}
      </span>
    );
  };

  const fieldLabel: Record<string, string> = {
    cpmLow: 'CPM Low', cpmHigh: 'CPM High',
    cpcLow: 'CPC Low', cpcHigh: 'CPC High',
    cprLow: 'CPR Low', cprHigh: 'CPR High',
    cpeLow: 'CPE Low', cpeHigh: 'CPE High',
    ctrLow: 'CTR Low', ctrHigh: 'CTR High',
    cplLow: 'CPL Low', cplHigh: 'CPL High',
    cplvLow: 'CPLV Low', cplvHigh: 'CPLV High',
    cpv2sLow: 'CPV 2s Low', cpv2sHigh: 'CPV 2s High',
    cpvTvLow: 'CPV TV Low', cpvTvHigh: 'CPV TV High',
    pageLikeLow: 'Per Like Low', pageLikeHigh: 'Per Like High',
    frequency: 'Frequency',
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-end">
      <div className="bg-white h-full w-full max-w-md overflow-y-auto shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E1E3EA] bg-[#F8F9FF] sticky top-0">
          <div>
            <h2 className="font-semibold text-[#071437] text-sm">
              {PLATFORM_LABEL[benchmark.platform] ?? benchmark.platform}
            </h2>
            <p className="text-xs text-[#99A1B7] mt-0.5">
              {OBJECTIVE_LABEL[benchmark.objective] ?? benchmark.objective} · Edit history
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#99A1B7] hover:text-[#071437] transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 p-5">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[#99A1B7] text-sm">Loading…</div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <p className="text-[#99A1B7] text-sm">No edit history yet.</p>
              <p className="text-[#CBD5E1] text-xs mt-1">Changes will appear here after the first edit.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <div key={h.id} className="border border-[#E1E3EA] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-[#071437]">
                      {fieldLabel[h.fieldChanged] ?? h.fieldChanged}
                    </span>
                    {sourceBadge(h.source)}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#99A1B7] line-through">{h.oldValue ?? '—'}</span>
                    <span className="text-[#CBD5E1]">→</span>
                    <span className="font-medium text-[#1B84FF]">{h.newValue ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-[#99A1B7]">
                    <span>{h.changedBy ?? 'System'}</span>
                    <span>{new Date(h.changedAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EditRangeCell ─────────────────────────────────────────────────────────────

interface EditRangeCellProps {
  loVal: number | string | null;
  hiVal: number | string | null;
  decimals: number;
  isCtr?: boolean;
  editable?: boolean;
  onSave: (lo: string, hi: string) => void;
}

function EditRangeCell({ loVal, hiVal, decimals, isCtr = false, editable = true, onSave }: EditRangeCellProps) {
  const [editing, setEditing] = useState(false);
  const [draftLo, setDraftLo] = useState('');
  const [draftHi, setDraftHi] = useState('');
  const loRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
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
        className={`px-1.5 py-0.5 rounded inline-block min-w-[48px] min-h-[20px] tabular-nums ${editable ? 'cursor-pointer hover:bg-[#EEF6FF]' : 'cursor-default'}`}
        onDoubleClick={editable ? startEdit : undefined}
        title={editable ? 'Double-click to edit (raw values)' : undefined}
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

function EditTextCell({ value, editable = true, onSave }: { value: string | null; editable?: boolean; onSave: (v: string) => void }) {
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
        className={`px-1.5 py-0.5 rounded inline-block min-w-[36px] min-h-[20px] ${editable ? 'cursor-pointer hover:bg-[#EEF6FF]' : 'cursor-default'}`}
        onDoubleClick={editable ? () => { setDraft(value ?? ''); setEditing(true); } : undefined}
        title={editable ? 'Double-click to edit' : undefined}
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [audienceType, setAudienceType] = useState<AudienceType>('mass');
  const [rows, setRows] = useState<Benchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sprint 3A state
  const [confidenceMap, setConfidenceMap] = useState<Map<string, ConfidenceScore>>(new Map());
  const [suggestionsMap, setSuggestionsMap] = useState<Map<string, BenchmarkSuggestion[]>>(new Map());
  const [historyBenchmark, setHistoryBenchmark] = useState<Benchmark | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, confidence, suggestions] = await Promise.all([
        fetchBenchmarks({ audienceType }),
        fetchConfidenceLevels().catch(() => []),
        fetchBenchmarkSuggestions().catch(() => [] as BenchmarkSuggestion[]),
      ]);
      setRows(data);

      // Build confidence lookup by benchmarkId
      const cMap = new Map<string, ConfidenceScore>();
      for (const c of confidence) cMap.set(c.benchmarkId, c);
      setConfidenceMap(cMap);

      // Build suggestions lookup by benchmarkId
      const sMap = new Map<string, BenchmarkSuggestion[]>();
      for (const s of suggestions) {
        const list = sMap.get(s.benchmarkId) ?? [];
        list.push(s);
        sMap.set(s.benchmarkId, list);
      }
      setSuggestionsMap(sMap);
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
        setToast({ message: 'Benchmark updated', type: 'success' });
      } catch {
        setToast({ message: 'Update failed', type: 'error' });
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
        setToast({ message: 'Benchmark updated', type: 'success' });
      } catch {
        setToast({ message: 'Update failed', type: 'error' });
      } finally {
        setSaving(null);
      }
    },
    [],
  );

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importBenchmarksCsv(file);
      await load();
      setToast({
        message: `Import complete: ${result.imported} added, ${result.updated} updated`,
        type: 'success',
      });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Import failed', type: 'error' });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportCsv = () => {
    const HEADERS = [
      'audience_type', 'objective', 'platform',
      'cpm_low', 'cpm_high', 'cpr_low', 'cpr_high',
      'cpe_low', 'cpe_high', 'cpc_low', 'cpc_high',
      'ctr_low', 'ctr_high', 'cpv_2s_low', 'cpv_2s_high',
      'cpv_tv_low', 'cpv_tv_high', 'cplv_low', 'cplv_high',
      'cpl_low', 'cpl_high', 'page_like_low', 'page_like_high',
      'currency', 'min_duration', 'min_daily_budget', 'frequency',
    ];
    const csvRows = [HEADERS.join(',')];
    for (const r of rows) {
      const cols = [
        r.audienceType, r.objective, r.platform,
        r.cpmLow ?? '', r.cpmHigh ?? '',
        r.cprLow ?? '', r.cprHigh ?? '',
        r.cpeLow ?? '', r.cpeHigh ?? '',
        r.cpcLow ?? '', r.cpcHigh ?? '',
        r.ctrLow ?? '', r.ctrHigh ?? '',
        r.cpv2sLow ?? '', r.cpv2sHigh ?? '',
        r.cpvTvLow ?? '', r.cpvTvHigh ?? '',
        r.cplvLow ?? '', r.cplvHigh ?? '',
        r.cplLow ?? '', r.cplHigh ?? '',
        r.pageLikeLow ?? '', r.pageLikeHigh ?? '',
        r.currency, r.minDuration ?? '', r.minDailyBudget ?? '', r.frequency ?? '',
      ];
      csvRows.push(cols.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `benchmarks-${audienceType}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const grouped = OBJECTIVES_ORDER.map((obj) => ({
    objective: obj,
    items: rows.filter((r) => r.objective === obj),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="card">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {historyBenchmark && (
        <HistoryPanel
          benchmark={historyBenchmark}
          onClose={() => setHistoryBenchmark(null)}
        />
      )}

      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImportCsv}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F1F4]">
        <div>
          <h2 className="text-base font-semibold text-[#071437]">KPI Benchmarks</h2>
          <p className="text-xs text-[#99A1B7] mt-0.5">
            {isAdmin
              ? 'Double-click any value to edit · Click platform name for history'
              : 'Read-only · Click platform name for edit history'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Confidence legend */}
          <div className="hidden lg:flex gap-3 text-xs text-[#99A1B7] border-r border-[#E1E3EA] pr-3">
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">● High</span>
              ≥10
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">◑ Med</span>
              3–9
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">○ Low</span>
              1–2
            </span>
          </div>

          <div className="flex gap-3 text-xs text-[#99A1B7]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#EEF6FF] border border-[#1B84FF]/40" />LKR
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FFF8DD] border border-[#F6B100]/40" />USD
            </span>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCsv}
                className="bg-white border border-[#E1E3EA] rounded-lg px-3 py-1.5 text-xs font-medium text-[#4B5675] hover:bg-[#F9F9F9] transition-colors"
              >
                Export CSV
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="bg-white border border-[#E1E3EA] rounded-lg px-3 py-1.5 text-xs font-medium text-[#4B5675] hover:bg-[#F9F9F9] transition-colors disabled:opacity-60"
              >
                {importing ? 'Importing…' : 'Import CSV'}
              </button>
            </div>
          )}

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
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-48 sticky left-0 bg-[#F9F9F9] border-r border-[#E1E3EA]">
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
                    const confidence = confidenceMap.get(row.id);
                    const pendingSuggestions = suggestionsMap.get(row.id) ?? [];
                    const hasSuggestion = pendingSuggestions.length > 0;

                    return (
                      <tr
                        key={row.id}
                        className={`border-b border-[#F1F1F4] transition-colors ${
                          saving === row.id ? 'opacity-60' : ''
                        } ${hasSuggestion ? 'ring-1 ring-inset ring-amber-200' : ''}`}
                        style={{ backgroundColor: rowBg }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isUsd ? '#FFF3CC' : '#F9F9F9')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = rowBg)}
                      >
                        <td
                          className="px-3 py-1.5 font-medium text-[#071437] sticky left-0 border-r border-[#F1F1F4] whitespace-nowrap"
                          style={{ backgroundColor: rowBg }}
                        >
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              onClick={() => setHistoryBenchmark(row)}
                              className="text-left hover:text-[#1B84FF] transition-colors"
                              title="Click to view edit history"
                            >
                              {PLATFORM_LABEL[row.platform] ?? row.platform}
                            </button>
                            {saving === row.id && (
                              <span className="text-[#1B84FF] text-[10px]">↻</span>
                            )}
                            {confidence && confidence.level !== 'none' && (
                              <ConfidenceBadge level={confidence.level} count={confidence.actualsCount} />
                            )}
                            {hasSuggestion && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-300 cursor-pointer"
                                title={`${pendingSuggestions.length} suggested update${pendingSuggestions.length > 1 ? 's' : ''} — go to Analytics to review`}
                              >
                                ⚡ Suggested Update
                              </span>
                            )}
                          </div>
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
                                  editable={isAdmin}
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
                                editable={isAdmin}
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
