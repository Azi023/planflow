'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface PlanRow {
  platform: string;
  budget: number | string | null;
  audienceName?: string;
}

interface BudgetAllocationChartProps {
  rows: PlanRow[];
  currency: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  meta_ig: 'Meta + IG',
  meta: 'Meta',
  Meta: 'Meta',
  ig: 'Instagram',
  ig_follower: 'IG Followers',
  meta_page_like: 'Page Likes',
  gdn: 'GDN',
  youtube_video: 'YouTube Video',
  youtube_bumper: 'YouTube Bumper',
  search: 'Google Search',
  demand_gen: 'Demand Gen',
  perf_max: 'Perf Max',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
};

const COLORS = [
  '#006098', '#2E7D32', '#E65100', '#6A1B9A',
  '#00838F', '#AD1457', '#EF6C00', '#283593',
  '#00695C', '#C62828', '#4E342E', '#37474F',
];

function formatBudget(value: number, currency: string): string {
  if (value >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${currency} ${(value / 1_000).toFixed(0)}K`;
  return `${currency} ${value.toLocaleString()}`;
}

export default function BudgetAllocationChart({ rows, currency }: BudgetAllocationChartProps) {
  const data = rows
    .filter((r) => r.budget && Number(r.budget) > 0)
    .map((r) => ({
      name: PLATFORM_LABELS[r.platform] ?? r.platform,
      value: Number(r.budget),
      audience: r.audienceName ?? '',
    }));

  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Budget Allocation
      </h4>
      <div className="flex items-center gap-4">
        <div className="w-48 h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => formatBudget(Number(value), currency)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((item, i) => {
            const pct = ((item.value / total) * 100).toFixed(1);
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-gray-700 flex-1 truncate">
                  {item.name}
                  {item.audience ? ` (${item.audience})` : ''}
                </span>
                <span className="text-gray-500 tabular-nums">
                  {formatBudget(item.value, currency)}
                </span>
                <span className="text-gray-400 tabular-nums w-12 text-right">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
