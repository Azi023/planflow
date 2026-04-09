'use client';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
}

function StatCard({ label, value, subtitle, icon, iconBg }: StatCardProps) {
  return (
    <div className="card px-6 py-5 flex items-start gap-4 hover:shadow-[0px_4px_12px_0px_rgba(0,0,0,0.08)] transition-shadow duration-200">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider mb-2">{label}</p>
        <p className="text-[24px] font-bold text-[#071437] leading-tight tabular-nums truncate">{value}</p>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      <StatCard
        label="Total Plans"
        value={totalPlans}
        subtitle={`${plansThisMonth} this month`}
        iconBg="#EEF6FF"
        icon={
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#1B84FF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        }
      />
      <StatCard
        label="Active Campaigns"
        value={plansThisMonth}
        subtitle="plans this month"
        iconBg="#EAFFF1"
        icon={
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#17C653]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        }
      />
      <StatCard
        label="Total Clients"
        value={totalClients}
        subtitle={`${totalClients} active`}
        iconBg="#F1EDFF"
        icon={
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#7239EA]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
        }
      />
      <StatCard
        label="Total Budget"
        value={`${currency} ${formatBudget(totalBudgetAllocated)}`}
        subtitle={`avg ${currency} ${formatBudget(avgPlanValue)} / plan`}
        iconBg="#FFF8DD"
        icon={
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#F6C000]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="1" x2="12" y2="23" />
            <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        }
      />
    </div>
  );
}
