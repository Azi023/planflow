'use client';

import { useState } from 'react';
import type { MediaPlanRow } from '@/lib/types';
import { bulkCreateActuals } from '@/lib/api';
import { PLATFORM_LABEL } from '@/lib/types';
import { abbr } from '@/lib/format';

interface Props {
  planId: string;
  planRows: MediaPlanRow[];
  onSaved: () => void;
}

interface ParsedRow {
  platform: string | null;
  actualImpressions: number | null;
  actualReach: number | null;
  actualClicks: number | null;
  actualSpend: number | null;
  actualCpm: number | null;
  actualCpc: number | null;
  actualCtr: number | null;
  actualVideoViews: number | null;
  actualLeads: number | null;
  actualEngagements: number | null;
  actualFrequency: number | null;
}

const PLATFORM_ALIASES: Record<string, string[]> = {
  meta_ig: ['meta+ig', 'meta + ig', 'facebook + instagram', 'fb+ig', 'meta & ig'],
  meta: ['meta only', 'facebook only', 'fb only'],
  ig: ['ig only', 'instagram only'],
  ig_follower: ['ig follower', 'instagram follower'],
  meta_page_like: ['meta page like', 'page like', 'page likes'],
  youtube_video: ['youtube video', 'youtube', 'yt video'],
  youtube_bumper: ['youtube bumper', 'yt bumper', 'bumper'],
  gdn: ['gdn', 'google display', 'display network'],
  search: ['search', 'google search', 'google ads search'],
  demand_gen: ['demand gen', 'demand generation'],
  perf_max: ['performance max', 'pmax', 'perf max'],
};

const COL_ALIASES: Record<keyof Omit<ParsedRow, 'platform'>, string[]> = {
  actualImpressions: ['impressions', 'impr', 'imps', 'impression'],
  actualReach: ['reach', 'unique reach', 'people reached', 'unique users'],
  actualClicks: ['clicks', 'link clicks', 'all clicks', 'total clicks'],
  actualSpend: ['spend', 'amount spent', 'cost', 'investment', 'total cost'],
  actualCpm: ['cpm', 'cost per 1000', 'cost per 1,000 impressions'],
  actualCpc: ['cpc', 'cost per click', 'avg. cpc'],
  actualCtr: ['ctr', 'click-through rate', 'click through rate'],
  actualVideoViews: ['video views', 'views', '3-second video views', 'thruplay', '3s views'],
  actualLeads: ['leads', 'results', 'conversions', 'form submissions'],
  actualEngagements: ['engagements', 'post engagements', 'engagement', 'reactions'],
  actualFrequency: ['frequency', 'avg frequency', 'average frequency'],
};

function matchPlatformToRowId(input: string, planRows: MediaPlanRow[]): string | null {
  const lower = input.toLowerCase().trim();
  for (const row of planRows) {
    if (row.platform === lower) return row.id;
    const aliases = PLATFORM_ALIASES[row.platform] ?? [];
    if (aliases.some((a) => lower.includes(a) || a.includes(lower))) return row.id;
  }
  return null;
}

function parseBulkPaste(text: string): ParsedRow[] {
  const lines = text.trim().split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase());

  const findCol = (aliases: string[]): number =>
    headers.findIndex((h) => aliases.some((a) => h.includes(a)));

  const platformIdx = findCol(['platform', 'channel', 'source', 'network', 'placement']);
  const indices = Object.fromEntries(
    Object.entries(COL_ALIASES).map(([key, aliases]) => [key, findCol(aliases)]),
  ) as Record<keyof Omit<ParsedRow, 'platform'>, number>;

  const getNum = (cols: string[], idx: number): number | null => {
    if (idx < 0 || !cols[idx]) return null;
    const cleaned = cols[idx].replace(/[$,₹€£%]/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  };

  return lines
    .slice(1)
    .map((line): ParsedRow => {
      const cols = line.split(sep).map((c) => c.trim());
      return {
        platform: platformIdx >= 0 ? (cols[platformIdx] ?? null) : null,
        actualImpressions: getNum(cols, indices.actualImpressions),
        actualReach: getNum(cols, indices.actualReach),
        actualClicks: getNum(cols, indices.actualClicks),
        actualSpend: getNum(cols, indices.actualSpend),
        actualCpm: getNum(cols, indices.actualCpm),
        actualCpc: getNum(cols, indices.actualCpc),
        actualCtr: getNum(cols, indices.actualCtr),
        actualVideoViews: getNum(cols, indices.actualVideoViews),
        actualLeads: getNum(cols, indices.actualLeads),
        actualEngagements: getNum(cols, indices.actualEngagements),
        actualFrequency: getNum(cols, indices.actualFrequency),
      };
    })
    .filter(
      (r) => r.platform != null || r.actualImpressions != null || r.actualSpend != null,
    );
}

export function ActualsBulkPaste({ planId, planRows, onSaved }: Props) {
  const [pasteText, setPasteText] = useState('');
  const [periodLabel, setPeriodLabel] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handlePreview = () => {
    const parsed = parseBulkPaste(pasteText);
    if (!parsed.length) {
      setError(
        'Could not parse the pasted data. Ensure the first row contains column headers (e.g. Platform, Impressions, Reach, Clicks, Spend).',
      );
      setPreview(null);
      return;
    }
    setError('');
    setPreview(parsed);
  };

  const handleImport = async () => {
    if (!preview?.length) return;

    const entries = preview.map((r) => ({
      rowId: r.platform ? (matchPlatformToRowId(r.platform, planRows) ?? undefined) : undefined,
      actualImpressions: r.actualImpressions ?? undefined,
      actualReach: r.actualReach ?? undefined,
      actualClicks: r.actualClicks ?? undefined,
      actualSpend: r.actualSpend ?? undefined,
      actualCpm: r.actualCpm ?? undefined,
      actualCpc: r.actualCpc ?? undefined,
      actualCtr: r.actualCtr ?? undefined,
      actualVideoViews: r.actualVideoViews ?? undefined,
      actualLeads: r.actualLeads ?? undefined,
      actualEngagements: r.actualEngagements ?? undefined,
      actualFrequency: r.actualFrequency ?? undefined,
    }));

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
      setSuccess(`Imported ${result.created} entr${result.created === 1 ? 'y' : 'ies'} successfully.`);
      setPasteText('');
      setPreview(null);
      setPeriodLabel('');
      setPeriodStart('');
      setPeriodEnd('');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium text-[#4B5675]">
          Paste data from Meta Ads Manager, Google Ads, or Excel:
        </p>
        <p className="text-xs text-[#99A1B7]">
          Tab-separated or CSV. First row must be headers:{' '}
          <code className="bg-[#F1F1F4] px-1 rounded">Platform, Impressions, Reach, Clicks, Spend, CPM, …</code>
        </p>
      </div>

      <textarea
        value={pasteText}
        onChange={(e) => {
          setPasteText(e.target.value);
          setPreview(null);
        }}
        placeholder={
          'Platform\tImpressions\tReach\tClicks\tSpend\tCPM\nMeta+IG\t3200000\t2800000\t1500\t250000\t78.12'
        }
        rows={6}
        className="w-full px-3 py-2 text-xs font-mono border border-[#E1E3EA] rounded-md bg-white focus:outline-none focus:border-[#1B84FF] resize-y"
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#4B5675]">Period Label</label>
          <input
            type="text"
            value={periodLabel}
            onChange={(e) => setPeriodLabel(e.target.value)}
            placeholder="Full Campaign"
            className="h-8 px-3 text-xs border border-[#E1E3EA] rounded-md bg-white focus:outline-none focus:border-[#1B84FF] w-44"
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
        <button
          onClick={handlePreview}
          disabled={!pasteText.trim()}
          className="h-8 px-4 text-xs font-semibold border border-[#1B84FF] text-[#1B84FF] rounded-md hover:bg-[#1B84FF]/10 disabled:opacity-40 transition-colors"
        >
          Preview
        </button>
      </div>

      {error && <p className="text-xs text-[#F8285A]">{error}</p>}
      {success && <p className="text-xs text-[#17C653]">{success}</p>}

      {preview && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-[#4B5675]">
            {preview.length} row{preview.length !== 1 ? 's' : ''} parsed — review before importing:
          </p>
          <div className="overflow-x-auto border border-[#E1E3EA] rounded-md">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E1E3EA]">
                  <th className="text-left px-3 py-2 font-medium text-[#4B5675]">
                    Platform (matched to plan row)
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-[#4B5675]">Impressions</th>
                  <th className="text-right px-3 py-2 font-medium text-[#4B5675]">Reach</th>
                  <th className="text-right px-3 py-2 font-medium text-[#4B5675]">Clicks</th>
                  <th className="text-right px-3 py-2 font-medium text-[#4B5675]">Spend</th>
                  <th className="text-right px-3 py-2 font-medium text-[#4B5675]">CPM</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => {
                  const matchedRowId = row.platform
                    ? matchPlatformToRowId(row.platform, planRows)
                    : null;
                  const matchedRow = planRows.find((r) => r.id === matchedRowId);
                  return (
                    <tr key={i} className="border-b border-[#E1E3EA] last:border-0 hover:bg-[#F9F9F9]">
                      <td className="px-3 py-1.5">
                        <span className="text-[#071437]">{row.platform ?? '—'}</span>
                        {matchedRow && (
                          <span className="ml-2 text-[#17C653] text-[10px]">
                            → {PLATFORM_LABEL[matchedRow.platform] ?? matchedRow.platform}
                          </span>
                        )}
                        {row.platform && !matchedRow && (
                          <span className="ml-2 text-[#F6B100] text-[10px]">⚠ no match</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[#4B5675]">
                        {row.actualImpressions != null ? abbr(row.actualImpressions) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[#4B5675]">
                        {row.actualReach != null ? abbr(row.actualReach) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[#4B5675]">
                        {row.actualClicks != null ? abbr(row.actualClicks) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[#4B5675]">
                        {row.actualSpend != null ? abbr(row.actualSpend) : '—'}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-[#4B5675]">
                        {row.actualCpm != null ? row.actualCpm.toFixed(2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold bg-[#1B84FF] text-white rounded-md hover:bg-[#1B84FF]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Importing…' : `Import ${preview.length} Entr${preview.length === 1 ? 'y' : 'ies'}`}
          </button>
        </div>
      )}
    </div>
  );
}
