'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  calculateKpis,
  createAudience,
  fetchAudiences,
  fetchClients,
  fetchCreativeTypes,
  createPlan,
  updatePlan,
  fetchPlanGroup,
  exportPlanExcel,
  exportPlanPptx,
} from '@/lib/api';
import type {
  Audience,
  AudienceType,
  CalculatedKpis,
  Client,
  CreativeType,
  MediaPlan as ApiMediaPlan,
  MediaPlanRow as ApiMediaPlanRow,
  Objective,
  Product,
} from '@/lib/types';
import { OBJECTIVES, PLATFORMS } from '@/lib/types';
import {
  fmtNum,
  fmtKpiRange,
  fullRange,
  fmtFreqRange,
  fmtCtrPct,
  applyBufferToKpis,
} from '@/lib/format';

// ─── helpers ─────────────────────────────────────────────────────────────────

function calcDuration(start: string, end: string): string {
  if (!start || !end) return '';
  const d1 = new Date(start);
  const d2 = new Date(end);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '';
  const days = Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
  if (days <= 0) return '';
  if (days === 1) return '1 day';
  if (days < 32) return `${days} days`;
  return `${Math.round(days / 30.44)} month${Math.round(days / 30.44) !== 1 ? 's' : ''}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlanRow {
  id: string;
  platform: string;
  objective: Objective | '';
  audienceType: AudienceType;
  audienceName: string;
  audienceSize: string;
  targetingCriteria: string;
  creative: string;
  country: string;
  buyType: string;
  budget: string;
  kpis: CalculatedKpis | null;
  loading: boolean;
  noData: boolean;
  currencyMismatch: boolean;
  benchmarkCurrency: string | null;
}

interface PlanVariant {
  name: string;
  rows: PlanRow[];
  savedId: string | null;
  referenceNumber: string | null;
  variantGroupId?: string | null;
}

interface PlanHeader {
  clientId: string;
  productId: string;
  campaignName: string;
  startDate: string;
  endDate: string;
  totalBudget: string;
  fee1Pct: string;
  fee1Label: string;
  fee2Pct: string;
  fee2Label: string;
  bufferPct: string;
  currency: string;
  notes: string;
  preparedBy: string;
}

interface MediaPlanBuilderProps {
  groupId?: string;
}

function emptyRow(): PlanRow {
  return {
    id: crypto.randomUUID(),
    platform: 'meta_ig',
    objective: 'awareness',
    audienceType: 'mass',
    audienceName: '',
    audienceSize: '',
    targetingCriteria: '',
    creative: '',
    country: '',
    buyType: '',
    budget: '',
    kpis: null,
    loading: false,
    noData: false,
    currencyMismatch: false,
    benchmarkCurrency: null,
  };
}

function defaultHeader(): PlanHeader {
  return {
    clientId: '',
    productId: '',
    campaignName: '',
    startDate: '',
    endDate: '',
    totalBudget: '',
    fee1Pct: '15',
    fee1Label: 'Management Fee',
    fee2Pct: '',
    fee2Label: '',
    bufferPct: '12',
    currency: 'LKR',
    notes: '',
    preparedBy: '',
  };
}

function apiPlanToHeader(plan: ApiMediaPlan): PlanHeader {
  return {
    clientId: plan.clientId ?? '',
    productId: plan.productId ?? '',
    campaignName: plan.campaignName ?? '',
    startDate: plan.startDate ?? '',
    endDate: plan.endDate ?? '',
    totalBudget: plan.totalBudget != null ? String(plan.totalBudget) : '',
    fee1Pct: String(plan.fee1Pct ?? 15),
    fee1Label: plan.fee1Label ?? 'Management Fee',
    fee2Pct: plan.fee2Pct != null ? String(plan.fee2Pct) : '',
    fee2Label: plan.fee2Label ?? '',
    bufferPct: String(plan.bufferPct ?? 12),
    currency: plan.currency ?? 'LKR',
    notes: plan.notes ?? '',
    preparedBy: plan.preparedBy ?? '',
  };
}

function apiRowToLocalRow(apiRow: ApiMediaPlanRow): PlanRow {
  return {
    id: apiRow.id,
    platform: apiRow.platform,
    objective: (apiRow.objective as Objective) || 'awareness',
    audienceType: (apiRow.audienceType as AudienceType) || 'mass',
    audienceName: apiRow.audienceName ?? '',
    audienceSize: apiRow.audienceSize ?? '',
    targetingCriteria: apiRow.targetingCriteria ?? '',
    creative: apiRow.creative ?? '',
    country: apiRow.country ?? '',
    buyType: apiRow.buyType ?? '',
    budget: apiRow.budget != null ? String(apiRow.budget) : '',
    kpis:
      apiRow.projectedKpis && Object.keys(apiRow.projectedKpis).length > 0
        ? (apiRow.projectedKpis as unknown as CalculatedKpis)
        : null,
    loading: false,
    noData: false,
    currencyMismatch: false,
    benchmarkCurrency: null,
  };
}

// ─── Summary card ────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent = '#1B84FF' }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-[8px] border border-[#E1E3EA] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ borderLeftColor: accent, borderLeftWidth: 3 }}>
      <p className="text-[11px] font-medium text-[#99A1B7] uppercase tracking-wide mb-1.5">{label}</p>
      <p className="text-xl font-bold text-[#071437] leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-[#99A1B7] mt-1 tabular-nums">{sub}</p>}
    </div>
  );
}

// ─── Row component ───────────────────────────────────────────────────────────

interface RowProps {
  row: PlanRow;
  idx: number;
  currency: string;
  totalMediaSpend: number;
  onChange: (id: string, patch: Partial<PlanRow>) => void;
  onRemove: (id: string) => void;
  audiences: Audience[];
  creativeTypes: CreativeType[];
}

function PlanRowItem({
  row,
  idx,
  currency,
  totalMediaSpend,
  onChange,
  onRemove,
  audiences,
  creativeTypes,
}: RowProps) {
  const ch = (patch: Partial<PlanRow>) => onChange(row.id, patch);
  const kpi = row.kpis;

  const pct =
    totalMediaSpend > 0 && row.budget
      ? (parseFloat(row.budget) / totalMediaSpend) * 100
      : null;

  const kpiCell = (content: React.ReactNode) => {
    if (row.loading) return <span className="text-[#1B84FF] text-[11px]">…</span>;
    if (row.currencyMismatch) return null;
    if (row.noData) return null;
    return content;
  };

  const firstKpiContent = () => {
    if (row.loading) return <span className="text-[#1B84FF]">…</span>;
    if (row.currencyMismatch) {
      return (
        <span
          className="text-[#F6B100] text-[10px] font-medium"
          title={`Benchmark uses ${row.benchmarkCurrency ?? 'USD'} pricing but budget is in ${currency}. Switch currency or enter budget in ${row.benchmarkCurrency ?? 'USD'}.`}
        >
          ⚠ {row.benchmarkCurrency ?? 'USD'} pricing
        </span>
      );
    }
    if (row.noData) {
      return <span className="text-[#99A1B7] italic text-[10px]">No benchmark data</span>;
    }
    return kpi ? (
      <span title={fullRange(kpi.impressions.low, kpi.impressions.high)} className="tabular-nums">
        {fmtKpiRange(kpi.impressions.low, kpi.impressions.high)}
      </span>
    ) : '—';
  };

  const rowClass = row.currencyMismatch
    ? 'border-b border-[#F6B100]/20 bg-[#FFF8DD] text-xs'
    : 'border-b border-[#F1F1F4] hover:bg-[#F9F9F9] text-xs transition-colors';

  return (
    <tr className={rowClass}>
      <td className="px-2 py-2 text-[#99A1B7] text-center sticky left-0 bg-inherit">{idx + 1}</td>

      <td className="px-2 py-1">
        <select
          value={row.platform}
          onChange={(e) => ch({ platform: e.target.value, kpis: null, noData: false, currencyMismatch: false })}
          className="w-full border-0 bg-transparent text-xs focus:outline-none"
        >
          {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </td>

      <td className="px-2 py-1">
        <select
          value={row.objective}
          onChange={(e) => ch({ objective: e.target.value as Objective, kpis: null, noData: false, currencyMismatch: false })}
          className="w-full border-0 bg-transparent text-xs focus:outline-none"
        >
          {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </td>

      <td className="px-2 py-1">
        <select
          value={row.audienceType}
          onChange={(e) => ch({ audienceType: e.target.value as AudienceType, kpis: null, noData: false, currencyMismatch: false })}
          className="w-full border-0 bg-transparent text-xs focus:outline-none"
        >
          <option value="mass">Mass</option>
          <option value="niche">Niche</option>
        </select>
      </td>

      <td className="px-2 py-1">
        <select
          value={row.audienceName}
          onChange={(e) => {
            const selected = audiences.find((a) => a.name === e.target.value);
            ch({
              audienceName: e.target.value,
              audienceSize: selected
                ? [selected.estimatedSizeMin, selected.estimatedSizeMax].filter(Boolean).join('-')
                : row.audienceSize,
              audienceType:
                selected?.audienceType === 'mass' || selected?.audienceType === 'niche'
                  ? (selected.audienceType as AudienceType)
                  : row.audienceType,
              targetingCriteria: selected
                ? [selected.interests, selected.behaviors, selected.demographics]
                    .filter(Boolean)
                    .join('; ')
                : row.targetingCriteria,
            });
          }}
          className="w-full border-0 bg-transparent text-xs focus:outline-none"
        >
          <option value="">— Select or type —</option>
          {audiences.map((a) => (
            <option key={a.id} value={a.name}>
              {a.name}
              {a.estimatedSizeMin
                ? ` (${a.estimatedSizeMin}${a.estimatedSizeMax ? '-' + a.estimatedSizeMax : ''})`
                : ''}
            </option>
          ))}
        </select>
      </td>

      <td className="px-2 py-1">
        <input
          value={row.audienceSize}
          onChange={(e) => ch({ audienceSize: e.target.value })}
          placeholder="e.g. 1.2M"
          className="w-full border-0 bg-transparent text-xs focus:outline-none placeholder:text-[#C9CDDA]"
        />
      </td>

      <td className="px-2 py-1">
        <select
          value={row.creative}
          onChange={(e) => ch({ creative: e.target.value })}
          className="w-full border-0 bg-transparent text-xs focus:outline-none"
        >
          <option value="">— Select —</option>
          {creativeTypes.map((ct) => (
            <option key={ct.id} value={ct.name}>
              {ct.name}
            </option>
          ))}
        </select>
      </td>

      {/* Country */}
      <td className="px-2 py-1">
        <select
          value={row.country}
          onChange={(e) => ch({ country: e.target.value })}
          className="w-full border-0 bg-transparent text-xs focus:outline-none"
        >
          <option value="">—</option>
          <option value="Sri Lanka">Sri Lanka</option>
          <option value="All Island">All Island</option>
          <option value="Middle East">Middle East</option>
          <option value="Kuwait">Kuwait</option>
          <option value="Global">Global</option>
        </select>
      </td>

      {/* Buy Type */}
      <td className="px-2 py-1">
        <select
          value={row.buyType}
          onChange={(e) => ch({ buyType: e.target.value })}
          className="w-full border-0 bg-transparent text-xs focus:outline-none"
        >
          <option value="">—</option>
          <option value="Auction">Auction</option>
          <option value="CPM">CPM</option>
          <option value="Awareness (Auction)">Awareness (Auction)</option>
          <option value="Reach & Frequency">Reach &amp; Frequency</option>
        </select>
      </td>

      {/* Budget */}
      <td className="px-2 py-1">
        <input
          type="number"
          value={row.budget}
          onChange={(e) => ch({ budget: e.target.value, kpis: null, noData: false, currencyMismatch: false })}
          placeholder="0"
          className="w-24 border-0 bg-transparent text-xs text-right focus:outline-none placeholder:text-[#C9CDDA]"
        />
        <span className="text-[#C9CDDA] ml-0.5 text-[10px]">{currency}</span>
      </td>

      {/* % of media spend */}
      <td className="px-2 py-1 text-right tabular-nums text-[#4B5675]">
        {pct != null && pct > 0 ? `${fmtNum(pct, 1)}%` : '—'}
      </td>

      {/* KPI columns */}
      <td className="px-2 py-1 text-center text-[#4B5675]">{firstKpiContent()}</td>

      <td className="px-2 py-1 text-center text-[#4B5675] tabular-nums">
        {kpiCell(
          kpi ? (
            <span title={fullRange(kpi.reach.low, kpi.reach.high)}>
              {fmtKpiRange(kpi.reach.low, kpi.reach.high)}
            </span>
          ) : '—',
        )}
      </td>

      <td className="px-2 py-1 text-center text-[#4B5675] tabular-nums">
        {kpiCell(kpi ? fmtFreqRange(kpi.frequency.low, kpi.frequency.high) : '—')}
      </td>

      <td className="px-2 py-1 text-center text-[#4B5675] tabular-nums">
        {kpiCell(
          kpi ? (
            <span title={fullRange(kpi.clicks.low, kpi.clicks.high)}>
              {fmtKpiRange(kpi.clicks.low, kpi.clicks.high)}
            </span>
          ) : '—',
        )}
      </td>

      <td className="px-2 py-1 text-center text-[#4B5675] tabular-nums">
        {kpiCell(
          kpi ? (
            <span>
              {kpi.ctr.low != null || kpi.ctr.high != null
                ? `${fmtCtrPct(kpi.ctr.low)} – ${fmtCtrPct(kpi.ctr.high)}`
                : '—'}
            </span>
          ) : '—',
        )}
      </td>

      {/* Video Views */}
      <td className="px-2 py-1 text-center text-[#4B5675] tabular-nums">
        {kpiCell(
          kpi ? (
            <span title={fullRange(kpi.videoViews2s.low, kpi.videoViews2s.high)}>
              {fmtKpiRange(kpi.videoViews2s.low, kpi.videoViews2s.high)}
            </span>
          ) : '—',
        )}
      </td>

      <td className="px-2 py-1 text-center text-[#4B5675] tabular-nums">
        {kpiCell(
          kpi ? (
            <span title={fullRange(kpi.leads.low, kpi.leads.high)}>
              {fmtKpiRange(kpi.leads.low, kpi.leads.high)}
            </span>
          ) : '—',
        )}
      </td>

      <td className="px-2 py-1 text-center">
        <button
          onClick={() => onRemove(row.id)}
          className="text-[#E1E3EA] hover:text-[#F8285A] transition-colors"
          title="Remove row"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function MediaPlanBuilder(props: MediaPlanBuilderProps = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [creativeTypes, setCreativeTypes] = useState<CreativeType[]>([]);
  const [header, setHeader] = useState<PlanHeader>(defaultHeader);
  const [variants, setVariants] = useState<PlanVariant[]>([
    { name: 'Option 1', rows: [emptyRow()], savedId: null, referenceNumber: null },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [initialLoading, setInitialLoading] = useState(!!props.groupId);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);

  // Stable refs — avoids stale closures in async callbacks
  const planRowsRef = useRef<PlanRow[]>(variants[0].rows);
  const headerRef = useRef<PlanHeader>(defaultHeader());
  const activeIdxRef = useRef(0);
  const calcTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const didInitCalc = useRef(false);

  useEffect(() => { planRowsRef.current = variants[activeIdx]?.rows ?? []; }, [variants, activeIdx]);
  useEffect(() => { headerRef.current = header; }, [header]);
  useEffect(() => { activeIdxRef.current = activeIdx; }, [activeIdx]);

  useEffect(() => {
    fetchClients().then(setClients).catch(() => {});
    fetchAudiences().then(setAudiences).catch(() => {});
    fetchCreativeTypes().then(setCreativeTypes).catch(() => {});
    // Auto-populate preparedBy from logged-in user for new plans
    if (!props.groupId) {
      try {
        const stored = localStorage.getItem('planflow_user');
        if (stored) {
          const user = JSON.parse(stored) as { name?: string };
          if (user.name) {
            setHeader((h) => ({ ...h, preparedBy: h.preparedBy || user.name! }));
          }
        }
      } catch { /* ignore */ }
    }
  }, []);

  // Load plan group from API when groupId is provided
  useEffect(() => {
    if (!props.groupId) return;
    fetchPlanGroup(props.groupId)
      .then((plans) => {
        if (!plans.length) return;
        setHeader(apiPlanToHeader(plans[0]));
        setVariants(
          plans.map((p) => ({
            name: p.variantName ?? 'Option 1',
            rows: (p.rows ?? [])
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map(apiRowToLocalRow),
            savedId: p.id,
            referenceNumber: p.referenceNumber ?? null,
            variantGroupId: p.variantGroupId,
          })),
        );
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, [props.groupId]);

  // ─── Auto-calculate (debounced, stable closure via refs) ──────────────────

  const calcRow = useCallback(
    (id: string, patchOverride?: Partial<PlanRow>) => {
      clearTimeout(calcTimers.current[id]);
      calcTimers.current[id] = setTimeout(async () => {
        const currentRow = planRowsRef.current.find((r) => r.id === id);
        if (!currentRow) return;
        const row = patchOverride ? { ...currentRow, ...patchOverride } : currentRow;

        if (!row.budget || !row.objective) {
          setVariants((vs) =>
            vs.map((v, i) =>
              i !== activeIdxRef.current
                ? v
                : { ...v, rows: v.rows.map((r) => (r.id === id ? { ...r, loading: false } : r)) },
            ),
          );
          return;
        }

        // Set loading
        setVariants((vs) =>
          vs.map((v, i) =>
            i !== activeIdxRef.current
              ? v
              : { ...v, rows: v.rows.map((r) => (r.id === id ? { ...r, loading: true } : r)) },
          ),
        );

        try {
          const raw = await calculateKpis({
            platform: row.platform,
            objective: row.objective,
            audienceType: row.audienceType,
            budget: parseFloat(row.budget),
            currency: headerRef.current.currency,
          });

          const mismatch = raw.benchmark.currency !== headerRef.current.currency;
          const buffer = parseFloat(headerRef.current.bufferPct) || 0;
          const kpis = mismatch ? null : applyBufferToKpis(raw, buffer);

          setVariants((vs) =>
            vs.map((v, i) =>
              i !== activeIdxRef.current
                ? v
                : {
                    ...v,
                    rows: v.rows.map((r) =>
                      r.id === id
                        ? {
                            ...r,
                            kpis,
                            loading: false,
                            noData: false,
                            currencyMismatch: mismatch,
                            benchmarkCurrency: raw.benchmark.currency,
                          }
                        : r,
                    ),
                  },
            ),
          );
        } catch (e) {
          const isNotFound = e instanceof Error && e.message.includes(': 404');
          setVariants((vs) =>
            vs.map((v, i) =>
              i !== activeIdxRef.current
                ? v
                : {
                    ...v,
                    rows: v.rows.map((r) =>
                      r.id === id
                        ? { ...r, loading: false, noData: isNotFound, currencyMismatch: false }
                        : r,
                    ),
                  },
            ),
          );
        }
      }, 350);
    },
    [],
  );

  // After plan loads, re-trigger KPI calculation for rows with budget but no saved kpis
  useEffect(() => {
    if (initialLoading || didInitCalc.current) return;
    if (!props.groupId) return;
    didInitCalc.current = true;
    planRowsRef.current.forEach((row) => {
      if (row.budget && !row.kpis && !row.loading) {
        calcRow(row.id);
      }
    });
  }, [initialLoading, props.groupId, calcRow]);

  const hdr = (patch: Partial<PlanHeader>) => setHeader((h) => ({ ...h, ...patch }));

  const activeVariant = variants[activeIdx];
  const activeRows = activeVariant.rows;

  const selectedClient = clients.find((c) => c.id === header.clientId);
  const products: Product[] = selectedClient?.products ?? [];

  // Budget math — supports two fee lines
  const totalBudgetNum = parseFloat(header.totalBudget) || 0;
  const fee1Num = parseFloat(header.fee1Pct) || 0;
  const fee2Num = parseFloat(header.fee2Pct) || 0;
  const totalFeePct = fee1Num + fee2Num;
  const mediaSpend = totalFeePct > 0 ? totalBudgetNum / (1 + totalFeePct / 100) : totalBudgetNum;
  const fee1Amount = mediaSpend * (fee1Num / 100);
  const fee2Amount = mediaSpend * (fee2Num / 100);
  const bufferNum = parseFloat(header.bufferPct) || 0;
  const rowBudgetTotal = activeRows.reduce((s, r) => s + (parseFloat(r.budget) || 0), 0);
  const duration = calcDuration(header.startDate, header.endDate);

  // ─── Variant management ───────────────────────────────────────────────────

  const updateActiveRows = useCallback(
    (updater: (rows: PlanRow[]) => PlanRow[]) => {
      setVariants((vs) =>
        vs.map((v, i) => (i !== activeIdxRef.current ? v : { ...v, rows: updater(v.rows) })),
      );
    },
    [],
  );

  const handleDuplicate = () => {
    const src = variants[activeIdxRef.current].rows;
    const groupId = variants[0].variantGroupId ?? variants[0].savedId;
    const newVariant: PlanVariant = {
      name: `Option ${variants.length + 1}`,
      rows: src.map((r) => ({
        ...r,
        id: crypto.randomUUID(),
        kpis: null,
        loading: false,
        noData: false,
        currencyMismatch: false,
      })),
      savedId: null,
      referenceNumber: null,
      variantGroupId: groupId,
    };
    setVariants((vs) => [...vs, newVariant]);
    setActiveIdx(variants.length);
  };

  const handleRowChange = useCallback(
    (id: string, patch: Partial<PlanRow>) => {
      updateActiveRows((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
      if (
        'platform' in patch ||
        'objective' in patch ||
        'audienceType' in patch ||
        'budget' in patch
      ) {
        calcRow(id, patch);
      }
    },
    [updateActiveRows, calcRow],
  );

  const handleRemoveRow = useCallback(
    (id: string) => {
      updateActiveRows((rows) => rows.filter((r) => r.id !== id));
    },
    [updateActiveRows],
  );

  // ─── Summary aggregates ───────────────────────────────────────────────────

  const validRows = activeRows.filter((r) => r.kpis && !r.currencyMismatch);
  const totalReach = {
    low: validRows.reduce((s, r) => s + (r.kpis?.reach.low ?? 0), 0) || null,
    high: validRows.reduce((s, r) => s + (r.kpis?.reach.high ?? 0), 0) || null,
  };
  const totalImpressions = {
    low: validRows.reduce((s, r) => s + (r.kpis?.impressions.low ?? 0), 0) || null,
    high: validRows.reduce((s, r) => s + (r.kpis?.impressions.high ?? 0), 0) || null,
  };
  const cpmRows = validRows.filter((r) => {
    const b = r.kpis?.benchmark;
    return b && (b.cpmLow != null || b.cpmHigh != null);
  });
  const avgCpm = cpmRows.length
    ? cpmRows.reduce((s, r) => {
        const b = r.kpis!.benchmark;
        const bRec = b as unknown as Record<string, unknown>;
        const lo = Number(bRec.cpmLow ?? bRec.cpm_low ?? 0);
        const hi = Number(bRec.cpmHigh ?? bRec.cpm_high ?? 0);
        return s + (lo + hi) / 2;
      }, 0) / cpmRows.length
    : null;

  // ─── Save ─────────────────────────────────────────────────────────────────

  const buildPayload = (variantName: string, rows: PlanRow[], variantGroupId?: string | null) => ({
    clientId: header.clientId || undefined,
    productId: header.productId || undefined,
    campaignName: header.campaignName || undefined,
    campaignPeriod: duration || undefined,
    startDate: header.startDate || undefined,
    endDate: header.endDate || undefined,
    totalBudget: totalBudgetNum || undefined,
    fee1Pct: fee1Num,
    fee1Label: header.fee1Label,
    fee2Pct: fee2Num || undefined,
    fee2Label: header.fee2Label || undefined,
    preparedBy: header.preparedBy || undefined,
    bufferPct: bufferNum,
    currency: header.currency,
    variantName,
    notes: header.notes || undefined,
    variantGroupId: variantGroupId ?? undefined,
    rows: rows.map((r, idx) => ({
      platform: r.platform,
      objective: r.objective || undefined,
      audienceType: r.audienceType,
      audienceName: r.audienceName || undefined,
      audienceSize: r.audienceSize || undefined,
      targetingCriteria: r.targetingCriteria || undefined,
      creative: r.creative || undefined,
      country: r.country || undefined,
      buyType: r.buyType || undefined,
      budget: parseFloat(r.budget) || undefined,
      projectedKpis: r.kpis ? { ...r.kpis } : {},
      sortOrder: idx,
    })),
  });

  const handleExportExcel = async () => {
    const savedId = activeVariant.savedId;
    if (!savedId) return;
    setExportingExcel(true);
    try {
      const safe = (header.campaignName || 'media-plan').replace(/[^a-zA-Z0-9-_]/g, '_');
      await exportPlanExcel(savedId, `${safe}.xlsx`);
    } catch {
      // ignore — browser will show nothing; user can retry
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportPptx = async () => {
    const savedId = activeVariant.savedId;
    if (!savedId) return;
    setExportingPptx(true);
    try {
      const safe = (header.campaignName || 'media-plan').replace(/[^a-zA-Z0-9-_]/g, '_');
      await exportPlanPptx(savedId, `${safe}.pptx`);
    } catch {
      // ignore
    } finally {
      setExportingPptx(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const variant = variants[activeIdx];
      // For Option 2+, use the first variant's variantGroupId
      const groupId = variants[0].variantGroupId ?? variants[0].savedId ?? undefined;
      const variantGroupId =
        variant.variantGroupId ?? (activeIdx === 0 ? undefined : groupId);
      const payload = buildPayload(variant.name, variant.rows, variantGroupId);

      const result = variant.savedId
        ? await updatePlan(variant.savedId, payload)
        : await createPlan(payload);

      const newGroupId = result.variantGroupId ?? result.id;

      setVariants((vs) =>
        vs.map((v, i) =>
          i === activeIdx
            ? {
                ...v,
                savedId: result.id,
                referenceNumber: result.referenceNumber ?? null,
                variantGroupId: newGroupId,
              }
            : v,
        ),
      );

      // Navigate to /media-plans/[groupId] on first save of Option 1
      if (!variant.savedId && activeIdx === 0 && !props.groupId) {
        router.push(`/media-plans/${newGroupId}`);
      }

      setSaveMsg('Saved!');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (initialLoading) {
    return (
      <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-8 text-center">
        <div className="flex items-center justify-center gap-2 text-[#99A1B7] text-sm">
          <div className="w-4 h-4 border-2 border-[#1B84FF]/30 border-t-[#1B84FF] rounded-full animate-spin" />
          Loading plan…
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Back to plans list */}
      {props.groupId && (
        <div className="px-6 pt-4">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-[#99A1B7] hover:text-[#1B84FF] flex items-center gap-1.5 transition-colors"
          >
            <span className="text-base leading-none">←</span> Back to Plans
          </button>
        </div>
      )}

      {/* Collapsible header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-[#F1F1F4] hover:bg-[#F9F9F9] transition-colors"
      >
        <div className="text-left">
          <h2 className="text-base font-semibold text-[#071437]">Media Plan Builder</h2>
          <p className="text-xs text-[#99A1B7] mt-0.5">Build a spreadsheet-style media plan with variant tabs</p>
        </div>
        <span className="text-[#99A1B7] text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-6 space-y-6">
          {/* Plan header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Client */}
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Client</label>
              <select
                value={header.clientId}
                onChange={(e) => {
                  const clientId = e.target.value;
                  const client = clients.find((c) => c.id === clientId);
                  hdr({
                    clientId,
                    productId: '',
                    ...(client
                      ? {
                          fee1Pct: String(client.defaultFee1Pct ?? 15),
                          fee1Label: client.defaultFee1Label ?? 'Management Fee',
                          fee2Pct: client.defaultFee2Pct != null ? String(client.defaultFee2Pct) : '',
                          fee2Label: client.defaultFee2Label ?? '',
                          currency: client.defaultCurrency ?? 'LKR',
                        }
                      : {}),
                  });
                }}
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors"
              >
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Product */}
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Product</label>
              <select
                value={header.productId}
                onChange={(e) => hdr({ productId: e.target.value })}
                disabled={!header.clientId}
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors disabled:bg-[#F9F9F9] disabled:text-[#99A1B7]"
              >
                <option value="">Select product…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Campaign Name */}
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Campaign Name</label>
              <input
                value={header.campaignName}
                onChange={(e) => hdr({ campaignName: e.target.value })}
                placeholder="e.g. Q1 Brand Awareness"
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors"
              />
            </div>

            {/* Prepared By */}
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Prepared By</label>
              <input
                value={header.preparedBy}
                onChange={(e) => hdr({ preparedBy: e.target.value })}
                placeholder="Planner name"
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors"
              />
            </div>

            {/* Campaign Period */}
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">
                Campaign Period
                {duration && <span className="ml-2 text-[#1B84FF] font-semibold">{duration}</span>}
              </label>
              <div className="flex gap-1 items-center">
                <input
                  type="date"
                  value={header.startDate}
                  onChange={(e) => hdr({ startDate: e.target.value })}
                  className="flex-1 border border-[#E1E3EA] rounded-[6px] px-2 py-2 text-xs text-[#071437] focus:outline-none focus:border-[#1B84FF] transition-colors"
                />
                <span className="text-[#99A1B7] text-xs">→</span>
                <input
                  type="date"
                  value={header.endDate}
                  min={header.startDate}
                  onChange={(e) => hdr({ endDate: e.target.value })}
                  className="flex-1 border border-[#E1E3EA] rounded-[6px] px-2 py-2 text-xs text-[#071437] focus:outline-none focus:border-[#1B84FF] transition-colors"
                />
              </div>
            </div>

            {/* Total Budget */}
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Total Budget</label>
              <div className="flex gap-1">
                <select
                  value={header.currency}
                  onChange={(e) => hdr({ currency: e.target.value })}
                  className="border border-[#E1E3EA] rounded-[6px] px-2 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] transition-colors w-20"
                >
                  <option value="LKR">LKR</option>
                  <option value="USD">USD</option>
                </select>
                <input
                  type="number"
                  value={header.totalBudget}
                  onChange={(e) => hdr({ totalBudget: e.target.value })}
                  placeholder="0"
                  className="flex-1 border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors"
                />
              </div>
            </div>

            {/* Fee Structure */}
            <div className="col-span-2 md:col-span-1">
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Fee Structure</label>
              <div className="space-y-1.5">
                <div className="flex gap-1 items-center">
                  <input
                    value={header.fee1Label}
                    onChange={(e) => hdr({ fee1Label: e.target.value })}
                    placeholder="Management Fee"
                    className="flex-1 border border-[#E1E3EA] rounded-[6px] px-2 py-1.5 text-xs text-[#071437] focus:outline-none focus:border-[#1B84FF] transition-colors"
                  />
                  <input
                    type="number"
                    value={header.fee1Pct}
                    onChange={(e) => hdr({ fee1Pct: e.target.value })}
                    placeholder="15"
                    className="w-16 border border-[#E1E3EA] rounded-[6px] px-2 py-1.5 text-xs text-right text-[#071437] focus:outline-none focus:border-[#1B84FF] transition-colors"
                  />
                  <span className="text-xs text-[#99A1B7]">%</span>
                </div>
                {header.fee2Pct || header.fee2Label ? (
                  <div className="flex gap-1 items-center">
                    <input
                      value={header.fee2Label}
                      onChange={(e) => hdr({ fee2Label: e.target.value })}
                      placeholder="ASP Fee"
                      className="flex-1 border border-[#E1E3EA] rounded-[6px] px-2 py-1.5 text-xs text-[#071437] focus:outline-none focus:border-[#1B84FF] transition-colors"
                    />
                    <input
                      type="number"
                      value={header.fee2Pct}
                      onChange={(e) => hdr({ fee2Pct: e.target.value })}
                      placeholder="0"
                      className="w-16 border border-[#E1E3EA] rounded-[6px] px-2 py-1.5 text-xs text-right text-[#071437] focus:outline-none focus:border-[#1B84FF] transition-colors"
                    />
                    <span className="text-xs text-[#99A1B7]">%</span>
                    <button
                      onClick={() => hdr({ fee2Pct: '', fee2Label: '' })}
                      className="text-[#E1E3EA] hover:text-[#F8285A] text-xs transition-colors"
                      title="Remove second fee"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => hdr({ fee2Pct: '0', fee2Label: '' })}
                    className="text-xs text-[#1B84FF] hover:underline transition-colors"
                  >
                    + Add fee line
                  </button>
                )}
              </div>
            </div>

            {/* Buffer % */}
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">
                Buffer %
                <span
                  className="ml-1 text-[#99A1B7] cursor-help"
                  title="Reduces HIGH KPI estimates to prevent overpromising. Low estimate is unchanged."
                >
                  ⓘ
                </span>
              </label>
              <input
                type="number"
                value={header.bufferPct}
                onChange={(e) => hdr({ bufferPct: e.target.value })}
                min={0}
                max={50}
                step={1}
                className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors"
              />
            </div>

            {/* Budget breakdown */}
            {totalBudgetNum > 0 && (
              <div className="bg-[#EEF6FF] rounded-[6px] border border-[#1B84FF]/20 px-3 py-2.5 text-xs space-y-0.5">
                <p className="text-[#071437] font-medium">
                  Media Spend: <span className="text-[#1B84FF] font-semibold">{header.currency} {fmtNum(mediaSpend)}</span>
                </p>
                <p className="text-[#4B5675]">
                  {header.fee1Label || 'Fee 1'} ({fee1Num}%): {header.currency} {fmtNum(fee1Amount)}
                </p>
                {fee2Num > 0 && (
                  <p className="text-[#4B5675]">
                    {header.fee2Label || 'Fee 2'} ({fee2Num}%): {header.currency} {fmtNum(fee2Amount)}
                  </p>
                )}
                {bufferNum > 0 && (
                  <p className="text-[#F6B100] font-medium mt-0.5">{bufferNum}% buffer on high estimates</p>
                )}
              </div>
            )}
          </div>

          {/* Variant tabs */}
          <div className="border-b border-[#E1E3EA]">
            <div className="flex items-center gap-0">
              {variants.map((v, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                    i === activeIdx
                      ? 'border-[#1B84FF] text-[#1B84FF]'
                      : 'border-transparent text-[#99A1B7] hover:text-[#4B5675] hover:border-[#E1E3EA]'
                  }`}
                >
                  {v.name}
                  {v.savedId && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#17C653]" title="Saved" />
                  )}
                </button>
              ))}
              <button
                onClick={handleDuplicate}
                className="ml-2 px-3 py-2 text-xs text-[#99A1B7] hover:text-[#1B84FF] transition-colors flex items-center gap-1"
                title="Duplicate current variant as a new option"
              >
                + Duplicate as Option {variants.length + 1}
              </button>
            </div>
          </div>

          {/* Reference number display */}
          {activeVariant.savedId && activeVariant.referenceNumber && (
            <div className="text-xs text-[#99A1B7] flex items-center gap-1.5">
              <span>Ref:</span>
              <span className="font-mono font-semibold text-[#4B5675] bg-[#F9F9F9] border border-[#E1E3EA] rounded px-1.5 py-0.5">{activeVariant.referenceNumber}</span>
            </div>
          )}

          {/* Rows table */}
          <div className="overflow-x-auto border border-[#E1E3EA] rounded-[8px]">
            <table className="w-full text-xs border-collapse min-w-[1600px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E1E3EA]">
                  <th className="px-2 py-2.5 w-8 sticky left-0 bg-[#F9F9F9] text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider">#</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-32">Platform</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-24">Objective</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-20">Audience</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-32">Audience Name</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-20">Est. Size</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-28">Creative</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-24">Country</th>
                  <th className="px-2 py-2.5 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-28">Buy Type</th>
                  <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-28">Budget</th>
                  <th className="px-2 py-2.5 text-right text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-16">%</th>
                  <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-28">Impressions</th>
                  <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-24">Reach</th>
                  <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-16">Freq</th>
                  <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-24">Clicks</th>
                  <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-20">CTR</th>
                  <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-24">Video Views</th>
                  <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider w-20">Leads</th>
                  <th className="px-2 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {activeRows.map((row, idx) => (
                  <PlanRowItem
                    key={row.id}
                    row={row}
                    idx={idx}
                    currency={header.currency}
                    totalMediaSpend={mediaSpend}
                    onChange={handleRowChange}
                    onRemove={handleRemoveRow}
                    audiences={audiences}
                    creativeTypes={creativeTypes}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F9F9F9] border-t border-[#E1E3EA] text-xs font-semibold text-[#071437]">
                  {/* cols: #, Platform, Objective, Audience, Audience Name, Est. Size, Creative, Country, Buy Type = 9 */}
                  <td colSpan={9} className="px-3 py-2 sticky left-0 bg-[#F9F9F9] text-[#4B5675]">Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {header.currency} {fmtNum(rowBudgetTotal)}
                  </td>
                  {/* % column — blank in total row */}
                  <td />
                  {/* Impressions */}
                  <td className="px-2 py-2 text-center text-[#4B5675] tabular-nums">
                    <span title={fullRange(totalImpressions.low, totalImpressions.high)}>
                      {fmtKpiRange(totalImpressions.low, totalImpressions.high)}
                    </span>
                  </td>
                  {/* Reach */}
                  <td className="px-2 py-2 text-center text-[#4B5675] tabular-nums">
                    <span title={fullRange(totalReach.low, totalReach.high)}>
                      {fmtKpiRange(totalReach.low, totalReach.high)}
                    </span>
                  </td>
                  {/* Freq, Clicks, CTR, Video Views, Leads, Delete */}
                  <td colSpan={5} />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <button
            onClick={() =>
              setVariants((vs) =>
                vs.map((v, i) => (i !== activeIdx ? v : { ...v, rows: [...v.rows, emptyRow()] })),
              )
            }
            className="text-sm text-[#1B84FF] hover:text-[#056EE9] font-medium flex items-center gap-1 hover:underline transition-colors"
          >
            + Add row
          </button>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              label={`Total Media Spend (${header.currency})`}
              value={totalBudgetNum ? `${header.currency} ${fmtNum(mediaSpend)}` : '—'}
              accent="#1B84FF"
            />
            <SummaryCard
              label="Total Reach (est.)"
              value={fmtKpiRange(totalReach.low, totalReach.high)}
              sub={fullRange(totalReach.low, totalReach.high) || undefined}
              accent="#17C653"
            />
            <SummaryCard
              label="Total Impressions (est.)"
              value={fmtKpiRange(totalImpressions.low, totalImpressions.high)}
              sub={fullRange(totalImpressions.low, totalImpressions.high) || undefined}
              accent="#7239EA"
            />
            <SummaryCard
              label="Avg CPM"
              value={avgCpm ? `${header.currency} ${fmtNum(avgCpm, 2)}` : '—'}
              accent="#F6B100"
            />
          </div>

          {/* Strategic notes */}
          <div>
            <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Strategic Notes</label>
            <textarea
              value={header.notes}
              onChange={(e) => hdr({ notes: e.target.value })}
              rows={3}
              placeholder="Platform caveats, targeting recommendations, creative notes…"
              className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors resize-none"
            />
          </div>

          {/* Save + Export */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1B84FF] text-white rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-[#056EE9] active:bg-[#0458C8] transition-colors disabled:opacity-60 shadow-sm flex items-center gap-2"
            >
              {saving && (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {saving
                ? 'Saving…'
                : activeVariant.savedId
                  ? `Update ${activeVariant.name}`
                  : `Save ${activeVariant.name}`}
            </button>
            {activeVariant.savedId && (
              <>
                <button
                  onClick={handleExportExcel}
                  disabled={exportingExcel}
                  className="bg-white border border-[#2E7D32] text-[#2E7D32] rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-[#F1F8F1] active:bg-[#E8F5E9] transition-colors disabled:opacity-60 shadow-sm flex items-center gap-2"
                  title="Download as Excel spreadsheet"
                >
                  {exportingExcel ? (
                    <span className="w-3.5 h-3.5 border-2 border-[#2E7D32]/30 border-t-[#2E7D32] rounded-full animate-spin" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  )}
                  {exportingExcel ? 'Generating…' : 'Export Excel'}
                </button>
                <button
                  onClick={handleExportPptx}
                  disabled={exportingPptx}
                  className="bg-white border border-[#D05A1E] text-[#D05A1E] rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-[#FFF3EE] active:bg-[#FFE8DC] transition-colors disabled:opacity-60 shadow-sm flex items-center gap-2"
                  title="Download as PowerPoint presentation"
                >
                  {exportingPptx ? (
                    <span className="w-3.5 h-3.5 border-2 border-[#D05A1E]/30 border-t-[#D05A1E] rounded-full animate-spin" />
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  )}
                  {exportingPptx ? 'Generating…' : 'Export PPTX'}
                </button>
              </>
            )}
            {saveMsg && (
              <span
                className={`text-sm font-medium ${saveMsg === 'Saved!' ? 'text-[#17C653]' : 'text-[#F8285A]'}`}
              >
                {saveMsg}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
