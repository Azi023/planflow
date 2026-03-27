'use client';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  accent?: string;
}

function StatCard({ label, value, subtitle, accent = '#1B84FF' }: StatCardProps) {
  return (
    <div className="card px-6 py-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">{label}</p>
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
      </div>
      <div>
        <p className="text-[26px] font-bold text-[#071437] leading-tight tabular-nums">{value}</p>
        <p className="text-[12px] text-[#99A1B7] mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

interface DashboardStatsProps {
  totalClients: number;
  totalPlans: number;
  plansThisMonth: number;
  totalBudgetAllocated: number;
  currency: string;
}

export function DashboardStats({
  totalClients,
  totalPlans,
  plansThisMonth,
  totalBudgetAllocated,
  currency,
}: DashboardStatsProps) {
  const avgPlanValue = totalPlans > 0 ? totalBudgetAllocated / totalPlans : 0;

  const formatBudget = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="grid grid-cols-4 gap-5">
      <StatCard
        label="Total Clients"
        value={totalClients}
        subtitle={`${totalClients} active`}
        accent="#1B84FF"
      />
      <StatCard
        label="Active Plans"
        value={totalPlans}
        subtitle={`${plansThisMonth} this month`}
        accent="#17C653"
      />
      <StatCard
        label="Total Budget Allocated"
        value={`${currency} ${formatBudget(totalBudgetAllocated)}`}
        subtitle={`across ${totalPlans} plan${totalPlans !== 1 ? 's' : ''}`}
        accent="#F6B100"
      />
      <StatCard
        label="Avg Plan Value"
        value={`${currency} ${formatBudget(avgPlanValue)}`}
        subtitle="per campaign"
        accent="#7239EA"
      />
    </div>
  );
}
