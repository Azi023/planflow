'use client';

import { useRouter } from 'next/navigation';

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

function StatusBadge({ status }: { status: string }) {
  if (status === 'sent') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#DFFFEA] text-[#17C653] border border-[#17C653]/20">
        Sent
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#EEF6FF] text-[#1B84FF] border border-[#1B84FF]/20">
        Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#F9F9F9] text-[#99A1B7] border border-[#E1E3EA]">
      Draft
    </span>
  );
}

interface RecentPlansProps {
  plans: RecentPlan[];
  loading: boolean;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-[#F1F1F4]">
      {[160, 120, 100, 90, 60].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="skeleton h-3.5 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export function RecentPlans({ plans, loading }: RecentPlansProps) {
  const router = useRouter();

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-[#F1F1F4] flex items-center justify-between">
        <p className="text-sm font-semibold text-[#071437]">Recent Plans</p>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F9F9F9] border-b border-[#E1E3EA]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Campaign</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Client</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Budget</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Status</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            )}
            {!loading && plans.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-[#99A1B7]">
                  No plans yet
                </td>
              </tr>
            )}
            {!loading && plans.map((plan) => (
              <tr
                key={plan.id}
                onClick={() => router.push(`/media-plans/${plan.id}`)}
                className="border-b border-[#F1F1F4] hover:bg-[#F9F9F9] cursor-pointer transition-colors last:border-0"
              >
                <td className="px-4 py-3 font-medium text-[#071437]">
                  {plan.campaignName ?? <span className="text-[#99A1B7] italic font-normal">Untitled</span>}
                  {plan.variantCount > 1 && (
                    <span className="ml-2 text-[10px] font-medium text-[#99A1B7] bg-[#F1F1F4] rounded px-1.5 py-0.5">
                      {plan.variantCount} variants
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#4B5675] text-xs">
                  {plan.clientName ?? '—'}
                  {plan.productName && (
                    <span className="block text-[#99A1B7]">{plan.productName}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[#4B5675] text-xs tabular-nums">
                  {plan.totalBudget
                    ? `${plan.currency} ${Number(plan.totalBudget).toLocaleString()}`
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={plan.status} />
                </td>
                <td className="px-4 py-3 text-[#99A1B7] text-xs">
                  {new Date(plan.createdAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3 border-t border-[#F1F1F4]">
        <button
          onClick={() => router.push('/media-plans')}
          className="text-xs font-medium text-[#1B84FF] hover:text-[#056EE9] transition-colors"
        >
          View all plans →
        </button>
      </div>
    </div>
  );
}
