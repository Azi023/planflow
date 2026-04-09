'use client';

import { useState } from 'react';

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

const MAX_VISIBLE = 8;

export function ClientOverview({ clients, loading }: ClientOverviewProps) {
  const [showAll, setShowAll] = useState(false);
  const maxBudget = clients.reduce((m, c) => Math.max(m, c.totalBudget), 0);
  const visibleClients = showAll ? clients : clients.slice(0, MAX_VISIBLE);

  const formatBudget = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b border-[#F1F1F4] flex items-center justify-between">
        <p className="text-[14px] font-semibold text-[#071437]">Client Overview</p>
        {clients.length > 0 && (
          <span className="text-[12px] text-[#99A1B7]">{clients.length} clients</span>
        )}
      </div>

      <div className="flex-1 divide-y divide-[#F1F1F4] max-h-[420px] overflow-y-auto">
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
          <div className="px-5 py-10 text-center text-[13px] text-[#99A1B7]">
            No client data yet
          </div>
        )}

        {!loading && visibleClients.map((client) => {
          const pct = maxBudget > 0 ? (client.totalBudget / maxBudget) * 100 : 0;
          return (
            <div key={client.clientId} className="px-5 py-3.5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[13px] font-medium text-[#071437]">{client.clientName}</p>
                  <p className="text-[11px] text-[#99A1B7] mt-0.5">
                    {client.planCount} plan{client.planCount !== 1 ? 's' : ''} · {client.productCount} product{client.productCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <p className="text-[12px] font-semibold text-[#4B5675] tabular-nums shrink-0 ml-3">
                  {client.totalBudget > 0 ? `LKR ${formatBudget(client.totalBudget)}` : '—'}
                </p>
              </div>
              {client.totalBudget > 0 && (
                <div className="h-1.5 bg-[#F1F1F4] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1B84FF] rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!loading && clients.length > MAX_VISIBLE && (
        <div className="px-5 py-3 border-t border-[#F1F1F4]">
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-[12px] font-medium text-[#1B84FF] hover:text-[#056EE9] transition-colors"
          >
            {showAll ? 'Show less' : `View all ${clients.length} clients`}
          </button>
        </div>
      )}
    </div>
  );
}
