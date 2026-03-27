'use client';

import { useState } from 'react';
import type { MediaPlanRow } from '@/lib/types';
import { bulkCreateActuals } from '@/lib/api';
import { PLATFORM_LABEL } from '@/lib/types';

interface Props {
  planId: string;
  planRows: MediaPlanRow[];
  currency: string;
  onSaved: () => void;
}

type EditableField =
  | 'impressions'
  | 'reach'
  | 'clicks'
  | 'spend'
  | 'engagements'
  | 'videoViews'
  | 'leads';

interface FormRow {
  rowId: string;
  platform: string;
  audienceName: string | null;
  impressions: string;
  reach: string;
  clicks: string;
  spend: string;
  engagements: string;
  videoViews: string;
  leads: string;
}

const EDITABLE_FIELDS: { field: EditableField; label: string }[] = [
  { field: 'impressions', label: 'Impressions' },
  { field: 'reach', label: 'Reach' },
  { field: 'clicks', label: 'Clicks' },
  { field: 'spend', label: 'Spend' },
  { field: 'engagements', label: 'Engagements' },
  { field: 'videoViews', label: 'Video Views' },
  { field: 'leads', label: 'Leads' },
];

function makeFormRows(planRows: MediaPlanRow[]): FormRow[] {
  return planRows.map((r) => ({
    rowId: r.id,
    platform: r.platform,
    audienceName: r.audienceName,
    impressions: '',
    reach: '',
    clicks: '',
    spend: '',
    engagements: '',
    videoViews: '',
    leads: '',
  }));
}

function parseNum(s: string): number | null {
  if (!s.trim()) return null;
  const n = parseFloat(s.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

export function ActualsQuickForm({ planId, planRows, currency, onSaved }: Props) {
  const [periodLabel, setPeriodLabel] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [rows, setRows] = useState<FormRow[]>(() => makeFormRows(planRows));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const updateRow = (idx: number, field: EditableField, value: string) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const handleSave = async () => {
    const entries = rows
      .map((r) => ({
        rowId: r.rowId,
        actualImpressions: parseNum(r.impressions),
        actualReach: parseNum(r.reach),
        actualClicks: parseNum(r.clicks),
        actualSpend: parseNum(r.spend),
        actualEngagements: parseNum(r.engagements),
        actualVideoViews: parseNum(r.videoViews),
        actualLeads: parseNum(r.leads),
      }))
      .filter((e) =>
        [
          e.actualImpressions,
          e.actualReach,
          e.actualClicks,
          e.actualSpend,
          e.actualEngagements,
          e.actualVideoViews,
          e.actualLeads,
        ].some((v) => v != null),
      );

    if (!entries.length) {
      setError('Enter at least one metric value before saving.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await bulkCreateActuals({
        planId,
        periodLabel: periodLabel || undefined,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        entries,
      });
      setSuccess(`Saved ${result.created} entr${result.created === 1 ? 'y' : 'ies'}.`);
      setRows(makeFormRows(planRows));
      setPeriodLabel('');
      setPeriodStart('');
      setPeriodEnd('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (planRows.length === 0) {
    return (
      <p className="text-sm text-[#99A1B7] text-center py-4">
        No plan rows found. Add rows in the Plan Builder tab first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period header */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#4B5675]">Period Label</label>
          <input
            type="text"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="e.g. Week 1, March 2026"
            className="h-8 px-3 text-xs border border-[#E1E3EA] rounded-md bg-white focus:outline-none focus:border-[#1B84FF] w-52"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#4B5675]">Start Date</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="h-8 px-3 text-xs border border-[#E1E3EA] rounded-md bg-white focus:outline-none focus:border-[#1B84FF]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#4B5675]">End Date</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="h-8 px-3 text-xs border border-[#E1E3EA] rounded-md bg-white focus:outline-none focus:border-[#1B84FF]"
          />
        </div>
      </div>

      {/* Form table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-[#F9F9F9]">
              <th className="text-left px-3 py-2 font-medium text-[#4B5675] border border-[#E1E3EA] whitespace-nowrap">
                Platform
              </th>
              <th className="text-left px-3 py-2 font-medium text-[#4B5675] border border-[#E1E3EA] whitespace-nowrap">
                Audience
              </th>
              {EDITABLE_FIELDS.map(({ field, label }) => (
                <th
                  key={field}
                  className="text-left px-3 py-2 font-medium text-[#4B5675] border border-[#E1E3EA] whitespace-nowrap"
                >
                  {label}
                  {field === 'spend' ? ` (${currency})` : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.rowId} className="hover:bg-[#F9F9F9]">
                <td className="px-3 py-1.5 border border-[#E1E3EA] font-medium text-[#071437] whitespace-nowrap">
                  {PLATFORM_LABEL[row.platform] ?? row.platform}
                </td>
                <td className="px-3 py-1.5 border border-[#E1E3EA] text-[#4B5675] whitespace-nowrap">
                  {row.audienceName ?? '—'}
                </td>
                {EDITABLE_FIELDS.map(({ field }) => (
                  <td key={field} className="p-1 border border-[#E1E3EA]">
                    <input
                      type="number"
                      value={row[field]}
                      onChange={(e) => updateRow(idx, field, e.target.value)}
                      placeholder="—"
                      className="w-24 h-7 px-2 text-xs border border-[#E1E3EA] rounded bg-white focus:outline-none focus:border-[#1B84FF] tabular-nums"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-[#F8285A]">{error}</p>}
      {success && <p className="text-xs text-[#17C653]">{success}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 text-xs font-semibold bg-[#1B84FF] text-white rounded-md hover:bg-[#1B84FF]/90 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving…' : 'Save Actuals'}
      </button>
    </div>
  );
}
