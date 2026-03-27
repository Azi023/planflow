'use client';

interface ClientSummaryItem {
  clientId: string;
  clientName: string;
  planCount: number;
  totalBudget: number;
  productCount: number;
}

interface ClientOverviewProps {
  clients: ClientSummaryItem[];
  loading: boolean;
}

export function ClientOverview({ clients, loading }: ClientOverviewProps) {
  const maxBudget = clients.reduce((m, c) => Math.max(m, c.totalBudget), 0);

  const formatBudget = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-[#F1F1F4]">
        <p className="text-sm font-semibold text-[#071437]">Client Overview</p>
      </div>

      <div className="flex-1 divide-y divide-[#F1F1F4]">
        {loading && (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="skeleton h-3.5 rounded w-32" />
                <div className="skeleton h-3 rounded w-16" />
              </div>
              <div className="skeleton h-1.5 rounded w-full" />
            </div>
          ))
        )}

        {!loading && clients.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-[#99A1B7]">
            No client data yet
          </div>
        )}

        {!loading && clients.map((client) => {
          const pct = maxBudget > 0 ? (client.totalBudget / maxBudget) * 100 : 0;
          return (
            <div key={client.clientId} className="px-5 py-4">
              <div className="flex items-start justify-between mb-2.5">
                <div>
                  <p className="text-sm font-medium text-[#071437]">{client.clientName}</p>
                  <p className="text-xs text-[#99A1B7] mt-0.5">
                    {client.planCount} plan{client.planCount !== 1 ? 's' : ''} · {client.productCount} product{client.productCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-xs font-semibold text-[#4B5675] tabular-nums shrink-0 ml-3">
                  LKR {formatBudget(client.totalBudget)}
                </p>
              </div>
              <div className="h-1.5 bg-[#F1F1F4] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1B84FF] rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
