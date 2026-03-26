'use client';

import { useEffect, useState } from 'react';
import { fetchDashboardStats } from '@/lib/api';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { RecentPlans } from '@/components/dashboard/RecentPlans';
import { ClientOverview } from '@/components/dashboard/ClientOverview';

interface RecentPlan {
  id: string;
  campaignName: string | null;
  clientName: string | null;
  productName: string | null;
  totalBudget: number | null;
  currency: string;
  status: string;
  createdAt: string;
  variantCount: number;
}

interface ClientSummaryItem {
  clientId: string;
  clientName: string;
  planCount: number;
  totalBudget: number;
  productCount: number;
}

interface PlatformBreakdownItem {
  platform: string;
  planCount: number;
  totalBudget: number;
}

interface DashboardData {
  totalClients: number;
  totalProducts: number;
  totalPlans: number;
  plansThisMonth: number;
  totalBudgetAllocated: number;
  currency: string;
  recentPlans: RecentPlan[];
  clientSummary: ClientSummaryItem[];
  platformBreakdown: PlatformBreakdownItem[];
}

const PLATFORM_COLORS: Record<string, string> = {
  meta_ig: '#1877F2',
  meta: '#1877F2',
  ig: '#E1306C',
  ig_follower: '#E1306C',
  meta_page_like: '#1877F2',
  youtube_video: '#FF0000',
  youtube_bumper: '#FF4500',
  gdn: '#34A853',
  search: '#4285F4',
  demand_gen: '#FBBC05',
  perf_max: '#EA4335',
  tiktok: '#010101',
};

const PLATFORM_LABELS: Record<string, string> = {
  meta_ig: 'Meta + IG',
  meta: 'Meta',
  ig: 'Instagram',
  ig_follower: 'IG Follower',
  meta_page_like: 'Meta Page Like',
  youtube_video: 'YouTube Video',
  youtube_bumper: 'YouTube Bumper',
  gdn: 'GDN',
  search: 'Search',
  demand_gen: 'Demand Gen',
  perf_max: 'Performance Max',
  tiktok: 'TikTok',
};

function PlatformBreakdown({ items, loading }: { items: PlatformBreakdownItem[]; loading: boolean }) {
  const total = items.reduce((s, i) => s + i.totalBudget, 0);

  const formatBudget = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-6 py-5">
      <p className="text-sm font-semibold text-[#071437] mb-5">Platform Budget Breakdown</p>

      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="flex justify-between mb-1.5">
                <div className="skeleton h-3.5 rounded w-24" />
                <div className="skeleton h-3 rounded w-16" />
              </div>
              <div className="skeleton h-2 rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-[#99A1B7] text-center py-6">No platform data yet</p>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => {
            const pct = total > 0 ? (item.totalBudget / total) * 100 : 0;
            const color = PLATFORM_COLORS[item.platform] ?? '#99A1B7';
            const label = PLATFORM_LABELS[item.platform] ?? item.platform;
            return (
              <div key={item.platform}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium text-[#4B5675]">{label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[#99A1B7]">LKR {formatBudget(item.totalBudget)}</span>
                    <span className="text-xs font-semibold text-[#071437] w-10 text-right tabular-nums">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-[#F1F1F4] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardStats()
      .then((d: DashboardData) => setData(d))
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-[1280px] mx-auto px-8 py-8">
      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-[#071437] leading-tight">Dashboard</h1>
        <p className="text-sm text-[#99A1B7] mt-1">Overview of your media planning activity</p>
      </div>

      {error && (
        <div className="bg-[#FFEEF3] border border-[#F8285A]/20 rounded-lg px-4 py-3 text-sm text-[#F8285A] mb-6">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-6">
        <DashboardStats
          totalClients={data?.totalClients ?? 0}
          totalPlans={data?.totalPlans ?? 0}
          plansThisMonth={data?.plansThisMonth ?? 0}
          totalBudgetAllocated={data?.totalBudgetAllocated ?? 0}
          currency={data?.currency ?? 'LKR'}
        />
      </div>

      {/* Middle: recent plans + client overview */}
      <div className="grid grid-cols-5 gap-5 mb-6">
        <div className="col-span-3">
          <RecentPlans plans={data?.recentPlans ?? []} loading={loading} />
        </div>
        <div className="col-span-2">
          <ClientOverview clients={data?.clientSummary ?? []} loading={loading} />
        </div>
      </div>

      {/* Platform breakdown */}
      <PlatformBreakdown items={data?.platformBreakdown ?? []} loading={loading} />
    </main>
  );
}
