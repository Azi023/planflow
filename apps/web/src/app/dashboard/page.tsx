'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchDashboardStats } from '@/lib/api';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { RecentPlans } from '@/components/dashboard/RecentPlans';
import { ClientOverview } from '@/components/dashboard/ClientOverview';
import { PageHeader } from '@/components/PageHeader';

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

interface CampaignDeliveryItem {
  planId: string;
  variantGroupId: string;
  campaignName: string | null;
  clientName: string | null;
  status: string;
  deliveryPct: number | null;
  hasActuals: boolean;
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
  campaignDelivery: CampaignDeliveryItem[];
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
    <div className="card px-6 py-5">
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

function deliveryColor(pct: number | null): string {
  if (pct == null) return '#99A1B7';
  if (pct >= 90) return '#17C653';
  if (pct >= 60) return '#F6B100';
  return '#F8285A';
}

function CampaignPerformance({
  items,
  loading,
}: {
  items: CampaignDeliveryItem[];
  loading: boolean;
}) {
  return (
    <div className="card px-6 py-5">
      <p className="text-sm font-semibold text-[#071437] mb-4">Campaign Performance</p>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="skeleton h-4 rounded w-32" />
              <div className="skeleton h-4 rounded w-24" />
              <div className="skeleton h-4 rounded w-16" />
            </div>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-sm text-[#99A1B7] text-center py-6">
          No approved or sent plans yet
        </p>
      )}

      {!loading && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#E1E3EA]">
                <th className="text-left pb-2.5 font-medium text-[#4B5675]">Campaign</th>
                <th className="text-left pb-2.5 font-medium text-[#4B5675]">Client</th>
                <th className="text-left pb-2.5 font-medium text-[#4B5675]">Status</th>
                <th className="text-right pb-2.5 font-medium text-[#4B5675]">Delivery</th>
                <th className="pb-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F1F4]">
              {items.map((item) => (
                <tr key={item.planId} className="hover:bg-[#F9F9F9]">
                  <td className="py-2.5 pr-4 font-medium text-[#071437] max-w-[180px] truncate">
                    {item.campaignName ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-[#4B5675]">{item.clientName ?? '—'}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        item.status === 'approved'
                          ? 'bg-[#DFFFEA] text-[#078A3C]'
                          : 'bg-[#E9F3FF] text-[#1B84FF]'
                      }`}
                    >
                      {item.status === 'approved' ? 'Approved' : 'Sent'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {item.hasActuals && item.deliveryPct != null ? (
                      <span
                        className="font-semibold"
                        style={{ color: deliveryColor(item.deliveryPct) }}
                      >
                        {item.deliveryPct}%
                      </span>
                    ) : (
                      <span className="text-[#99A1B7]">No data</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <Link
                      href={`/media-plans/${item.variantGroupId}`}
                      className="text-[#1B84FF] hover:underline whitespace-nowrap"
                    >
                      Enter Actuals →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your media planning activity"
        breadcrumbs={[{ label: 'Home' }, { label: 'Dashboard' }]}
        action={
          <Link
            href="/media-plans/new"
            className="inline-flex items-center gap-2 bg-[#1B84FF] hover:bg-[#056EE9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Plan
          </Link>
        }
      />

      <div className="p-8 space-y-6">
        {error && (
          <div className="bg-[#FFEEF3] border border-[#F8285A]/20 rounded-lg px-4 py-3 text-sm text-[#F8285A]">
            {error}
          </div>
        )}

        {/* Stat cards */}
        <DashboardStats
          totalClients={data?.totalClients ?? 0}
          totalPlans={data?.totalPlans ?? 0}
          plansThisMonth={data?.plansThisMonth ?? 0}
          totalBudgetAllocated={data?.totalBudgetAllocated ?? 0}
          currency={data?.currency ?? 'LKR'}
        />

        {/* Recent plans + client overview */}
        <div className="grid grid-cols-5 gap-5">
          <div className="col-span-3">
            <RecentPlans plans={data?.recentPlans ?? []} loading={loading} />
          </div>
          <div className="col-span-2">
            <ClientOverview clients={data?.clientSummary ?? []} loading={loading} />
          </div>
        </div>

        {/* Platform breakdown + Campaign performance */}
        <div className="grid grid-cols-2 gap-5">
          <PlatformBreakdown items={data?.platformBreakdown ?? []} loading={loading} />
          <CampaignPerformance items={data?.campaignDelivery ?? []} loading={loading} />
        </div>
      </div>
    </>
  );
}
