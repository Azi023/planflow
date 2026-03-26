'use client';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle: string;
}

function StatCard({ label, value, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] px-6 py-5">
      <p className="text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-bold text-[#071437] leading-tight">{value}</p>
      <p className="text-xs text-[#99A1B7] mt-1.5">{subtitle}</p>
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
      />
      <StatCard
        label="Active Plans"
        value={totalPlans}
        subtitle={`${plansThisMonth} this month`}
      />
      <StatCard
        label="Total Budget Allocated"
        value={`${currency} ${formatBudget(totalBudgetAllocated)}`}
        subtitle={`across ${totalPlans} plan${totalPlans !== 1 ? 's' : ''}`}
      />
      <StatCard
        label="Avg Plan Value"
        value={`${currency} ${formatBudget(avgPlanValue)}`}
        subtitle="per campaign"
      />
    </div>
  );
}
