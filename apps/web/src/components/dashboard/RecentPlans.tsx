'use client';

import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/StatusBadge';

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

interface RecentPlansProps {
  plans: RecentPlan[];
  loading: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#F1F1F4]">
      {[160, 100, 80, 70, 60].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="skeleton h-3.5 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export function RecentPlans({ plans, loading }: RecentPlansProps) {
  const router = useRouter();
  const visiblePlans = plans.filter(p => !p.campaignName?.includes('Meta Historical Actuals'));

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-[#F1F1F4] flex items-center justify-between">
        <p className="text-[14px] font-semibold text-[#071437]">Recent Plans</p>
        <button
          onClick={() => router.push('/media-plans')}
          className="text-[12px] font-medium text-[#1B84FF] hover:text-[#056EE9] transition-colors"
        >
          View All &rarr;
        </button>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F9F9F9] border-b border-[#E1E3EA]">
              {['Campaign', 'Client', 'Budget', 'Status', 'Created'].map(col => (
                <th key={col} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && visiblePlans.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#DBDFE9]" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p className="text-[13px] text-[#99A1B7]">No plans yet</p>
                    <button
                      onClick={() => router.push('/media-plans/new')}
                      className="text-[12px] font-medium text-[#1B84FF] hover:text-[#056EE9] transition-colors"
                    >
                      Create your first media plan
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!loading && visiblePlans.map((plan) => (
              <tr
                key={plan.id}
                onClick={() => router.push(`/media-plans/${plan.id}`)}
                className="border-b border-[#F1F1F4] hover:bg-[#FAFAFA] cursor-pointer transition-colors duration-150 last:border-0"
              >
                <td className="px-4 py-3.5">
                  <div className="text-[13px] font-medium text-[#071437]">
                    {plan.campaignName ?? <span className="text-[#99A1B7] italic font-normal">Untitled</span>}
                  </div>
                  {plan.variantCount > 1 && (
                    <span className="text-[10px] font-medium text-[#99A1B7] bg-[#F1F1F4] rounded px-1.5 py-0.5 mt-0.5 inline-block">
                      {plan.variantCount} variants
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="text-[13px] text-[#4B5675]">{plan.clientName ?? '—'}</div>
                  {plan.productName && (
                    <div className="text-[11px] text-[#99A1B7] mt-0.5">{plan.productName}</div>
                  )}
                </td>
                <td className="px-4 py-3.5 text-[13px] text-[#4B5675] tabular-nums">
                  {plan.totalBudget
                    ? `${plan.currency} ${Number(plan.totalBudget).toLocaleString()}`
                    : '—'}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={plan.status} />
                </td>
                <td className="px-4 py-3.5 text-[12px] text-[#99A1B7]">
                  {timeAgo(plan.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
