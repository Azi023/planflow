'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  calculateKpis,
  fetchAudiences,
  fetchClients,
  fetchCreativeTypes,
  createPlan,
  updatePlan,
  fetchPlanGroup,
  exportPlanExcel,
  exportPlanPptx,
  updatePlanStatus,
  duplicatePlan,
  createTemplateFromPlan,
  enableSharing,
  disableSharing,
  fetchPlanComments,
} from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';
import { StatusBadge } from '@/components/StatusBadge';
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
  fmtKpi,
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
  notes: string;
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
  status: string;
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
  usdExchangeRate: string;
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
    notes: '',
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
    usdExchangeRate: '330',
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
    usdExchangeRate: plan.usdExchangeRate != null ? String(plan.usdExchangeRate) : '330',
    notes: plan.notes ?? '',
    preparedBy: plan.preparedBy ?? '',
  };
}

function safeKpiRange(obj: unknown, key: string): { low: number | null; high: number | null } {
  if (!obj || typeof obj !== 'object') return { low: null, high: null };
  const container = (obj as Record<string, unknown>)[key];
  if (!container || typeof container !== 'object') return { low: null, high: null };
  const c = container as Record<string, unknown>;
  return {
    low: c.low != null ? Number(c.low) : null,
    high: c.high != null ? Number(c.high) : null,
  };
}

function apiRowToLocalRow(apiRow: ApiMediaPlanRow): PlanRow {
  const kpisRaw = apiRow.projectedKpis;
  const hasKpis = kpisRaw && typeof kpisRaw === 'object' && Object.keys(kpisRaw).length > 0;

  let kpis: CalculatedKpis | null = null;
  if (hasKpis) {
    const raw = kpisRaw as Record<string, unknown>;
    kpis = {
      impressions: safeKpiRange(raw, 'impressions'),
      reach: safeKpiRange(raw, 'reach'),
      clicks: safeKpiRange(raw, 'clicks'),
      engagements: safeKpiRange(raw, 'engagements'),
      videoViews2s: safeKpiRange(raw, 'videoViews2s'),
      videoViewsTv: safeKpiRange(raw, 'videoViewsTv'),
      landingPageViews: safeKpiRange(raw, 'landingPageViews'),
      leads: safeKpiRange(raw, 'leads'),
      frequency: safeKpiRange(raw, 'frequency'),
      ctr: safeKpiRange(raw, 'ctr'),
      benchmark: (raw.benchmark as CalculatedKpis['benchmark']) ?? null,
    } as CalculatedKpis;
  }

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
    notes: apiRow.notes ?? '',
    kpis,
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
  selected: boolean;
  showNotes: boolean;
  onChange: (id: string, patch: Partial<PlanRow>) => void;
  onRemove: (id: string) => void;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleNotes: (id: string) => void;
  audiences: Audience[];
  creativeTypes: CreativeType[];
}

function PlanRowItem({
  row,
  idx,
  currency,
  totalMediaSpend,
  selected,
  showNotes,
  onChange,
  onRemove,
  onToggleSelect,
  onToggleNotes,
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
    if (row.noData) return null;
    return content;
  };

  const optionCCell = (range: { low: number | null; high: number | null }) => (
    <div>
      <span className="font-semibold tabular-nums">{fmtKpi(range.low)}</span>
      {range.high != null && range.high !== range.low && (
        <span className="block text-[9px] text-[#99A1B7] tabular-nums leading-tight">
          {fmtKpiRange(range.low, range.high)}
        </span>
      )}
    </div>
  );

  const firstKpiContent = () => {
    if (row.loading) return <span className="text-[#1B84FF]">…</span>;
    if (row.noData) {
      return <span className="text-[#99A1B7] italic text-[10px]">No benchmark data</span>;
    }
    return kpi ? (
      <div>
        <span title={fullRange(kpi.impressions.low, kpi.impressions.high)}>
          {optionCCell(kpi.impressions)}
        </span>
        {row.currencyMismatch && (
          <span
            className="block text-[9px] text-[#F6B100] font-medium"
            title={`Budget converted from ${currency} to ${row.benchmarkCurrency ?? 'USD'} for KPI projection`}
          >
            {row.benchmarkCurrency ?? 'USD'} rate
          </span>
        )}
      </div>
    ) : '—';
  };

  const rowClass = row.currencyMismatch
    ? 'border-b border-[#F6B100]/10 hover:bg-[#FFFDF5] text-xs transition-colors'
    : selected
      ? 'border-b border-[#1B84FF]/20 bg-[#EEF6FF] text-xs'
      : 'border-b border-[#F1F1F4] hover:bg-[#F9F9F9] text-xs transition-colors';

  return (
    <>
      <tr className={rowClass}>
        {/* Checkbox */}
        <td className="px-2 py-2 text-center sticky left-0 bg-inherit">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelect(row.id, e.target.checked)}
            className="rounded border-[#E1E3EA] cursor-pointer"
          />
        </td>

        <td className="px-2 py-2 text-[#99A1B7] text-center">{idx + 1}</td>

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
                {optionCCell(kpi.reach)}
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
                {optionCCell(kpi.clicks)}
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
                {optionCCell(kpi.videoViews2s)}
              </span>
            ) : '—',
          )}
        </td>

        <td className="px-2 py-1 text-center text-[#4B5675] tabular-nums">
          {kpiCell(
            kpi ? (
              <span title={fullRange(kpi.leads.low, kpi.leads.high)}>
                {optionCCell(kpi.leads)}
              </span>
            ) : '—',
          )}
        </td>

        {/* Notes toggle */}
        <td className="px-2 py-1 text-center">
          <button
            onClick={() => onToggleNotes(row.id)}
            className={`text-sm transition-colors ${row.notes ? 'text-[#F6B100]' : 'text-[#E1E3EA] hover:text-[#99A1B7]'}`}
            title={row.notes || 'Add note'}
          >
            📝
          </button>
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

      {/* Inline notes row */}
      {showNotes && (
        <tr className="bg-[#FFFDF5] border-b border-[#F6B100]/20">
          <td colSpan={2} />
          <td colSpan={18} className="px-3 py-2">
            <input
              value={row.notes}
              onChange={(e) => ch({ notes: e.target.value })}
              placeholder="Platform caveats, targeting tips, creative notes…"
              className="w-full bg-transparent border-0 text-xs text-[#4B5675] focus:outline-none placeholder:text-[#C9CDDA]"
            />
          </td>
          <td />
        </tr>
      )}
    </>
  );
}

// ─── Save as Template Modal ───────────────────────────────────────────────────

interface SaveTemplateModalProps {
  campaignName: string;
  onSave: (name: string, description: string, category: string, isGlobal: boolean) => Promise<void>;
  onClose: () => void;
  isAdmin: boolean;
}

function SaveTemplateModal({ campaignName, onSave, onClose, isAdmin }: SaveTemplateModalProps) {
  const [name, setName] = useState(`${campaignName || 'Plan'} Template`);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSave(name.trim(), description, category, isGlobal);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[12px] border border-[#E1E3EA] shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-[#F1F1F4]">
          <h3 className="text-base font-semibold text-[#071437]">Save as Template</h3>
          <p className="text-xs text-[#99A1B7] mt-0.5">Reuse this plan structure for future campaigns</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Template Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-[#1B84FF]"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Description <span className="text-[#99A1B7] font-normal">(optional)</span></label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Standard FMCG awareness campaign"
              className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-[#1B84FF]"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm focus:outline-none focus:border-[#1B84FF]"
            >
              <option value="">— None —</option>
              <option value="FMCG">FMCG</option>
              <option value="Banking">Banking</option>
              <option value="Seasonal">Seasonal</option>
              <option value="E-commerce">E-commerce</option>
              <option value="Other">Other</option>
            </select>
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isGlobal}
                onChange={(e) => setIsGlobal(e.target.checked)}
                className="rounded border-[#E1E3EA]"
              />
              <span className="text-sm text-[#4B5675]">Make available to all users</span>
            </label>
          )}
          {error && <p className="text-xs text-[#F8285A]">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-[#F1F1F4] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#4B5675] border border-[#E1E3EA] rounded-lg hover:bg-[#F9F9F9] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="px-4 py-2 text-sm font-semibold text-[#7239EA] border border-[#7239EA] rounded-lg hover:bg-[#F8F5FF] transition-colors disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Period presets ───────────────────────────────────────────────────────────

const PERIOD_PRESETS = [
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
  { label: '2 Months', days: 61 },
  { label: '3 Months', days: 91 },
  { label: '6 Months', days: 183 },
];

// ─── Main ────────────────────────────────────────────────────────────────────

// ─── Share Modal ─────────────────────────────────────────────────────────────

interface ShareModalProps {
  shareUrl: string;
  onRevoke: () => void;
  onClose: () => void;
}

function ShareModal({ shareUrl, onRevoke, onClose }: ShareModalProps) {
  const [copyMsg, setCopyMsg] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyMsg('Copied!');
      setTimeout(() => setCopyMsg(''), 2000);
    } catch {
      setCopyMsg('Copy failed');
      setTimeout(() => setCopyMsg(''), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[12px] border border-[#E1E3EA] shadow-xl w-full max-w-md p-6">
        <h3 className="text-base font-semibold text-[#071437] mb-1">Share Plan with Client</h3>
        <p className="text-[13px] text-[#99A1B7] mb-4">Anyone with this link can view the plan without logging in.</p>
        <div className="flex gap-2 mb-4">
          <input
            readOnly
            value={shareUrl}
            className="flex-1 border border-[#E1E3EA] rounded-[6px] px-3 py-2 text-sm text-[#4B5675] bg-[#F9F9F9] focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="bg-[#1B84FF] text-white rounded-[6px] px-4 py-2 text-sm font-medium hover:bg-[#056EE9] transition-colors whitespace-nowrap"
          >
            {copyMsg || 'Copy Link'}
          </button>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-[#F1F1F4]">
          <button
            onClick={onRevoke}
            className="text-sm text-[#F8285A] hover:underline"
          >
            Revoke Access
          </button>
          <button
            onClick={onClose}
            className="bg-white border border-[#E1E3EA] text-[#4B5675] rounded-[6px] px-4 py-2 text-sm font-medium hover:bg-[#F9F9F9] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function MediaPlanBuilder(props: MediaPlanBuilderProps = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [open, setOpen] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [creativeTypes, setCreativeTypes] = useState<CreativeType[]>([]);
  const [header, setHeader] = useState<PlanHeader>(defaultHeader);
  const [variants, setVariants] = useState<PlanVariant[]>([
    { name: 'Option 1', rows: [emptyRow()], savedId: null, referenceNumber: null, status: 'draft' },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [initialLoading, setInitialLoading] = useState(!!props.groupId);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPptx, setExportingPptx] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Bulk row operations
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Notes visibility per row
  const [openNotesRowIds, setOpenNotesRowIds] = useState<Set<string>>(new Set());

  // Save as template modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Share modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [unreadComments, setUnreadComments] = useState(0);

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
          const u = JSON.parse(stored) as { name?: string };
          if (u.name) {
            setHeader((h) => ({ ...h, preparedBy: h.preparedBy || u.name! }));
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
            status: p.status ?? 'draft',
          })),
        );
        // Fetch unread comments for this plan
        if (plans[0]?.id) {
          fetchPlanComments(plans[0].id)
            .then((comments) => {
              const unread = (comments as Array<{ isRead: boolean }>).filter((c) => !c.isRead).length;
              setUnreadComments(unread);
            })
            .catch(() => {});
        }
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

          let kpis: CalculatedKpis | null;
          if (mismatch) {
            // Convert budget to benchmark currency before calculating KPIs
            const rate = parseFloat(headerRef.current.usdExchangeRate) || 330;
            const planCurrency = headerRef.current.currency;
            const benchCurrency = raw.benchmark.currency;
            let convertedBudget = parseFloat(row.budget);
            if (planCurrency === 'LKR' && benchCurrency === 'USD') {
              convertedBudget = parseFloat(row.budget) / rate;
            } else if (planCurrency === 'USD' && benchCurrency === 'LKR') {
              convertedBudget = parseFloat(row.budget) * rate;
            }
            try {
              const convertedRaw = await calculateKpis({
                platform: row.platform,
                objective: row.objective,
                audienceType: row.audienceType,
                budget: convertedBudget,
                currency: benchCurrency,
              });
              kpis = applyBufferToKpis(convertedRaw, buffer);
            } catch {
              kpis = null;
            }
          } else {
            kpis = applyBufferToKpis(raw, buffer);
          }

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

  // ─── Period presets ────────────────────────────────────────────────────────

  const applyPreset = (days: number) => {
    const start = new Date();
    const dayOfWeek = start.getDay();
    const daysToMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
    start.setDate(start.getDate() + daysToMonday);
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);
    hdr({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    });
  };

  // ─── Variant management ───────────────────────────────────────────────────

  const updateActiveRows = useCallback(
    (updater: (rows: PlanRow[]) => PlanRow[]) => {
      setVariants((vs) =>
        vs.map((v, i) => (i !== activeIdxRef.current ? v : { ...v, rows: updater(v.rows) })),
      );
    },
    [],
  );

  const handleDuplicateVariant = () => {
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
      status: 'draft',
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
      setSelectedRowIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      setOpenNotesRowIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    },
    [updateActiveRows],
  );

  // ─── Bulk row operations ──────────────────────────────────────────────────

  const handleToggleSelect = useCallback((id: string, checked: boolean) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }, []);

  const handleToggleNotes = useCallback((id: string) => {
    setOpenNotesRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const bulkUpdateRows = (patch: Partial<PlanRow>) => {
    updateActiveRows((rows) =>
      rows.map((r) =>
        selectedRowIds.has(r.id)
          ? { ...r, ...patch, kpis: null, noData: false, currencyMismatch: false }
          : r,
      ),
    );
    selectedRowIds.forEach((id) => calcRow(id, patch));
    setSelectedRowIds(new Set());
  };

  const bulkDeleteRows = () => {
    updateActiveRows((rows) => rows.filter((r) => !selectedRowIds.has(r.id)));
    setSelectedRowIds(new Set());
  };

  // ─── Summary aggregates ───────────────────────────────────────────────────

  const validRows = activeRows.filter((r) => r.kpis);

  const safeSum = (
    rows: PlanRow[],
    path: (kpi: CalculatedKpis) => { low: number | null; high: number | null } | undefined,
  ): { low: number | null; high: number | null } => {
    let lowSum = 0;
    let highSum = 0;
    let hasAny = false;
    for (const r of rows) {
      if (!r.kpis) continue;
      const range = path(r.kpis);
      if (!range) continue;
      if (range.low != null) { lowSum += range.low; hasAny = true; }
      if (range.high != null) { highSum += range.high; hasAny = true; }
    }
    return hasAny ? { low: lowSum || null, high: highSum || null } : { low: null, high: null };
  };

  const totalReach = safeSum(validRows, (k) => k.reach);
  const totalImpressions = safeSum(validRows, (k) => k.impressions);
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
    usdExchangeRate: parseFloat(header.usdExchangeRate) || 330,
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
      notes: r.notes || undefined,
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
      // ignore
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
                status: result.status ?? v.status,
              }
            : v,
        ),
      );

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

  const handleDuplicatePlan = async () => {
    const savedId = activeVariant.savedId;
    if (!savedId) return;
    setDuplicating(true);
    try {
      const result = await duplicatePlan(savedId);
      const newGroupId = result.variantGroupId ?? result.id;
      setSaveMsg('Plan duplicated!');
      setTimeout(() => setSaveMsg(''), 3000);
      router.push(`/media-plans/${newGroupId}`);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Duplicate failed');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setDuplicating(false);
    }
  };

  const handleSaveAsTemplate = async (
    name: string,
    description: string,
    category: string,
    isGlobal: boolean,
  ) => {
    const savedId = activeVariant.savedId;
    if (!savedId) return;
    await createTemplateFromPlan(savedId, { name, description, category, isGlobal });
    setSaveMsg('Template saved!');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  const handleShare = async () => {
    const savedId = activeVariant.savedId;
    if (!savedId) return;
    setSharingLoading(true);
    try {
      const result = await enableSharing(savedId);
      setShareToken(result.shareToken);
      setShowShareModal(true);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Share failed');
      setTimeout(() => setSaveMsg(''), 3000);
    } finally {
      setSharingLoading(false);
    }
  };

  const handleRevokeShare = async () => {
    const savedId = activeVariant.savedId;
    if (!savedId) return;
    try {
      await disableSharing(savedId);
      setShareToken(null);
      setShowShareModal(false);
      setSaveMsg('Share link revoked');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Revoke failed');
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  // ─── Status workflow ──────────────────────────────────────────────────────

  const handleStatusChange = async (newStatus: string) => {
    const savedId = activeVariant.savedId;
    if (!savedId) return;
    try {
      const result = await updatePlanStatus(savedId, newStatus);
      setVariants((vs) =>
        vs.map((v, i) => (i === activeIdx ? { ...v, status: result.status } : v)),
      );
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Status update failed');
      setTimeout(() => setSaveMsg(''), 3000);
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
      {showTemplateModal && (
        <SaveTemplateModal
          campaignName={header.campaignName}
          onSave={handleSaveAsTemplate}
          onClose={() => setShowTemplateModal(false)}
          isAdmin={isAdmin}
        />
      )}

      {showShareModal && shareToken && (
        <ShareModal
          shareUrl={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002'}/shared/${shareToken}`}
          onRevoke={handleRevokeShare}
          onClose={() => setShowShareModal(false)}
        />
      )}

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

            {/* Campaign Period with presets */}
            <div>
              <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">
                Campaign Period
                {duration && <span className="ml-2 text-[#1B84FF] font-semibold">{duration}</span>}
              </label>
              {/* Quick presets */}
              <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                <span className="text-[10px] text-[#99A1B7] font-medium shrink-0">Quick:</span>
                {PERIOD_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPreset(p.days)}
                    className="px-2 py-0.5 text-[10px] rounded border border-[#E1E3EA] text-[#4B5675] hover:bg-[#F9F9F9] hover:border-[#1B84FF] transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
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

            {/* USD Exchange Rate — shown when plan currency is LKR */}
            {header.currency === 'LKR' && (
              <div>
                <label className="block text-[13px] font-medium text-[#4B5675] mb-1.5">
                  USD Rate
                  <span className="ml-1 text-[#99A1B7] cursor-help" title="Used to convert budgets for platforms with USD benchmarks (YouTube, TikTok)">ⓘ</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-[#99A1B7] whitespace-nowrap">1 USD =</span>
                  <input
                    type="number"
                    value={header.usdExchangeRate}
                    onChange={(e) => hdr({ usdExchangeRate: e.target.value })}
                    placeholder="330"
                    className="w-20 border border-[#E1E3EA] rounded-[6px] px-2 py-2 text-sm text-[#071437] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition-colors"
                  />
                  <span className="text-xs text-[#99A1B7]">LKR</span>
                </div>
              </div>
            )}

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
                onClick={handleDuplicateVariant}
                className="ml-2 px-3 py-2 text-xs text-[#99A1B7] hover:text-[#1B84FF] transition-colors flex items-center gap-1"
                title="Duplicate current variant as a new option"
              >
                + Duplicate as Option {variants.length + 1}
              </button>
            </div>
          </div>

          {/* Reference number + status display */}
          {activeVariant.savedId && (
            <div className="flex items-center gap-3 flex-wrap">
              {activeVariant.referenceNumber && (
                <div className="text-xs text-[#99A1B7] flex items-center gap-1.5">
                  <span>Ref:</span>
                  <span className="font-mono font-semibold text-[#4B5675] bg-[#F9F9F9] border border-[#E1E3EA] rounded px-1.5 py-0.5">
                    {activeVariant.referenceNumber}
                  </span>
                </div>
              )}
              <StatusBadge status={activeVariant.status} />
            </div>
          )}

          {/* Bulk action bar */}
          {selectedRowIds.size > 0 && (
            <div className="flex items-center gap-3 flex-wrap bg-[#EEF6FF] border border-[#1B84FF]/20 rounded-lg px-4 py-2.5 text-sm">
              <span className="font-semibold text-[#1B84FF] shrink-0">
                {selectedRowIds.size} row{selectedRowIds.size > 1 ? 's' : ''} selected
              </span>
              <span className="text-[#E1E3EA]">|</span>

              <label className="text-[11px] text-[#4B5675] shrink-0">Platform:</label>
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  bulkUpdateRows({ platform: e.target.value });
                  e.target.value = '';
                }}
                className="border border-[#E1E3EA] rounded px-2 py-1 text-xs"
              >
                <option value="">— Change —</option>
                {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>

              <label className="text-[11px] text-[#4B5675] shrink-0">Objective:</label>
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  bulkUpdateRows({ objective: e.target.value as Objective });
                  e.target.value = '';
                }}
                className="border border-[#E1E3EA] rounded px-2 py-1 text-xs"
              >
                <option value="">— Change —</option>
                {OBJECTIVES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <label className="text-[11px] text-[#4B5675] shrink-0">Audience:</label>
              <select
                onChange={(e) => {
                  if (!e.target.value) return;
                  bulkUpdateRows({ audienceType: e.target.value as AudienceType });
                  e.target.value = '';
                }}
                className="border border-[#E1E3EA] rounded px-2 py-1 text-xs"
              >
                <option value="">— Change —</option>
                <option value="mass">Mass</option>
                <option value="niche">Niche</option>
              </select>

              <button
                onClick={bulkDeleteRows}
                className="ml-auto text-[#F8285A] hover:text-[#D6204E] font-medium flex items-center gap-1 text-xs"
              >
                🗑 Delete Selected
              </button>
            </div>
          )}

          {/* Rows table */}
          <div className="overflow-x-auto border border-[#E1E3EA] rounded-[8px]">
            <table className="w-full text-xs border-collapse min-w-[1700px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E1E3EA]">
                  <th className="px-2 py-2.5 w-8 sticky left-0 bg-[#F9F9F9]">
                    <input
                      type="checkbox"
                      checked={selectedRowIds.size === activeRows.length && activeRows.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRowIds(new Set(activeRows.map((r) => r.id)));
                        } else {
                          setSelectedRowIds(new Set());
                        }
                      }}
                      className="rounded border-[#E1E3EA] cursor-pointer"
                    />
                  </th>
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
                  <th className="px-2 py-2.5 w-8 text-center text-[10px] font-semibold text-[#99A1B7]" title="Notes">📝</th>
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
                    selected={selectedRowIds.has(row.id)}
                    showNotes={openNotesRowIds.has(row.id)}
                    onChange={handleRowChange}
                    onRemove={handleRemoveRow}
                    onToggleSelect={handleToggleSelect}
                    onToggleNotes={handleToggleNotes}
                    audiences={audiences}
                    creativeTypes={creativeTypes}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#F9F9F9] border-t border-[#E1E3EA] text-xs font-semibold text-[#071437]">
                  {/* cols: checkbox, #, Platform, Objective, Audience, Audience Name, Est. Size, Creative, Country, Buy Type = 10 */}
                  <td colSpan={10} className="px-3 py-2 sticky left-0 bg-[#F9F9F9] text-[#4B5675]">Total</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {header.currency} {fmtNum(rowBudgetTotal)}
                  </td>
                  {/* % column */}
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
                  {/* Freq, Clicks, CTR, Video Views, Leads, Notes, Delete */}
                  <td colSpan={5} />
                  <td />
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
              value={totalReach.low ? fmtKpi(totalReach.low) : '—'}
              sub={totalReach.low && totalReach.high ? `Range: ${fmtKpiRange(totalReach.low, totalReach.high)}` : undefined}
              accent="#17C653"
            />
            <SummaryCard
              label="Total Impressions (est.)"
              value={totalImpressions.low ? fmtKpi(totalImpressions.low) : '—'}
              sub={totalImpressions.low && totalImpressions.high ? `Range: ${fmtKpiRange(totalImpressions.low, totalImpressions.high)}` : undefined}
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

          {/* Unread client comments notification */}
          {unreadComments > 0 && (
            <div className="flex items-center gap-2 bg-[#FFF8DD] border border-[#F6B100]/20 rounded-lg px-3 py-2 text-sm">
              <span className="text-[#F6B100]">💬</span>
              <span className="text-[#4B5675]">
                {unreadComments} new client comment{unreadComments > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setUnreadComments(0)}
                className="text-[#1B84FF] font-medium hover:underline text-xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Save + Export + Actions */}
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
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="bg-white border border-[#7239EA] text-[#7239EA] rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-[#F8F5FF] transition-colors shadow-sm"
                  title="Save this plan structure as a reusable template"
                >
                  💾 Save as Template
                </button>
                <button
                  onClick={handleDuplicatePlan}
                  disabled={duplicating}
                  className="bg-white border border-[#E1E3EA] text-[#4B5675] rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#F9F9F9] transition-colors flex items-center gap-2 disabled:opacity-60"
                  title="Clone this plan to a new draft"
                >
                  {duplicating ? (
                    <span className="w-3.5 h-3.5 border-2 border-[#4B5675]/30 border-t-[#4B5675] rounded-full animate-spin" />
                  ) : '📋'}
                  {duplicating ? 'Duplicating…' : 'Duplicate Plan'}
                </button>
                <button
                  onClick={handleShare}
                  disabled={sharingLoading}
                  className="bg-white border border-[#1B84FF] text-[#1B84FF] rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-[#EEF6FF] transition-colors flex items-center gap-2 disabled:opacity-60"
                  title="Share this plan with the client"
                >
                  {sharingLoading ? (
                    <span className="w-3.5 h-3.5 border-2 border-[#1B84FF]/30 border-t-[#1B84FF] rounded-full animate-spin" />
                  ) : '🔗'}
                  {sharingLoading ? 'Loading…' : 'Share with Client'}
                </button>
              </>
            )}
            {/* Status workflow buttons */}
            {activeVariant.savedId && (() => {
              const status = activeVariant.status;
              return (
                <>
                  {status === 'draft' && (
                    <button
                      onClick={() => handleStatusChange('pending_review')}
                      className="bg-[#FFF8DD] border border-[#F6B100]/30 text-[#B07D00] rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#FFF0AA] transition-colors"
                    >
                      Submit for Review
                    </button>
                  )}
                  {status === 'pending_review' && (
                    <>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => handleStatusChange('approved')}
                          className="bg-[#DFFFEA] border border-[#17C653]/30 text-[#0F8A3C] rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#C0F5D0] transition-colors"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => handleStatusChange('draft')}
                        className="bg-white border border-[#E1E3EA] text-[#4B5675] rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#F9F9F9] transition-colors"
                      >
                        Return to Draft
                      </button>
                    </>
                  )}
                  {status === 'approved' &&
                    (user?.role === 'admin' || user?.role === 'account_manager') && (
                      <button
                        onClick={() => handleStatusChange('sent')}
                        className="bg-[#EEF6FF] border border-[#1B84FF]/30 text-[#1B84FF] rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-[#D8ECFF] transition-colors"
                      >
                        Mark as Sent
                      </button>
                    )}
                </>
              );
            })()}
            {saveMsg && (
              <span
                className={`text-sm font-medium ${saveMsg === 'Saved!' || saveMsg.includes('duplicated') || saveMsg.includes('Template') ? 'text-[#17C653]' : 'text-[#F8285A]'}`}
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
