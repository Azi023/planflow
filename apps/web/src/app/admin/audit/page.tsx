'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchAuditLogs } from '@/lib/api';
import type { AuditLogEntry } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';

const ENTITY_TYPES = [
  { value: '', label: 'All Entities' },
  { value: 'media_plan', label: 'Media Plans' },
  { value: 'benchmark', label: 'Benchmarks' },
  { value: 'template', label: 'Templates' },
  { value: 'actuals', label: 'Actuals' },
  { value: 'user', label: 'Users' },
];

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'plan.created', label: 'Plan Created' },
  { value: 'plan.updated', label: 'Plan Updated' },
  { value: 'plan.exported', label: 'Plan Exported' },
  { value: 'plan.shared', label: 'Plan Shared' },
  { value: 'plan.status_changed', label: 'Status Changed' },
  { value: 'plan.duplicated', label: 'Plan Duplicated' },
  { value: 'plan.deleted', label: 'Plan Deleted' },
  { value: 'plan.version_restored', label: 'Version Restored' },
  { value: 'benchmark.updated', label: 'Benchmark Updated' },
  { value: 'benchmark.imported', label: 'Benchmark Imported' },
  { value: 'shared.viewed', label: 'Shared Viewed' },
  { value: 'shared.commented', label: 'Shared Commented' },
  { value: 'shared.approved', label: 'Client Approved' },
  { value: 'user.login', label: 'User Login' },
];

const ACTION_COLORS: Record<string, string> = {
  'plan.created': 'bg-[#EAFFF1] text-[#04B440]',
  'plan.updated': 'bg-[#EEF6FF] text-[#1B84FF]',
  'plan.exported': 'bg-[#F1EDFF] text-[#7239EA]',
  'plan.shared': 'bg-[#F1EDFF] text-[#7239EA]',
  'plan.status_changed': 'bg-[#FFF8DD] text-[#E5AD00]',
  'plan.duplicated': 'bg-[#EEF6FF] text-[#1B84FF]',
  'plan.deleted': 'bg-[#FFEEF3] text-[#E0103F]',
  'plan.version_restored': 'bg-[#FFF8DD] text-[#E5AD00]',
  'benchmark.updated': 'bg-[#EEF6FF] text-[#1B84FF]',
  'benchmark.imported': 'bg-[#EAFFF1] text-[#04B440]',
  'shared.viewed': 'bg-[#F9F9F9] text-[#78829D]',
  'shared.commented': 'bg-[#F9F9F9] text-[#78829D]',
  'shared.approved': 'bg-[#EAFFF1] text-[#04B440]',
  'user.login': 'bg-[#F9F9F9] text-[#78829D]',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAction(action: string): string {
  return action.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

function formatDetails(entry: AuditLogEntry): string {
  const m = entry.metadata;
  if (m.campaignName) return String(m.campaignName);
  if (m.format) return `Format: ${String(m.format).toUpperCase()}`;
  if (m.oldStatus && m.newStatus) return `${String(m.oldStatus)} → ${String(m.newStatus)}`;
  if (m.authorName) return `By ${String(m.authorName)}`;
  if (m.email) return String(m.email);
  if (m.imported) return `${m.imported} imported, ${m.updated} updated`;
  return '—';
}

export default function AuditLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadLogs = () => {
    setLoading(true);
    fetchAuditLogs({
      page,
      limit: 20,
      entityType: entityType || undefined,
      action: action || undefined,
      from: dateFrom || undefined,
      to: dateTo || undefined,
    })
      .then((res) => {
        setLogs(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadLogs(); }, [page, entityType, action, dateFrom, dateTo]);

  const hasFilters = entityType || action || dateFrom || dateTo;

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Track all system activity"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Admin' }, { label: 'Audit Log' }]}
      />

      <div className="p-6 lg:p-8">
        <div className="card overflow-hidden">
          {/* Filters */}
          <div className="px-6 py-4 border-b border-[#F1F1F4]">
            <div className="flex items-center gap-3 flex-wrap">
              <select value={entityType} onChange={e => { setEntityType(e.target.value); setPage(1); }} className="border border-[#DBDFE9] rounded-lg px-3 py-2.5 text-[13px] text-[#4B5675] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition">
                {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }} className="border border-[#DBDFE9] rounded-lg px-3 py-2.5 text-[13px] text-[#4B5675] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition">
                {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="border border-[#DBDFE9] rounded-lg px-3 py-2.5 text-[13px] text-[#4B5675] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition" placeholder="From" />
              <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="border border-[#DBDFE9] rounded-lg px-3 py-2.5 text-[13px] text-[#4B5675] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition" placeholder="To" />
              {hasFilters && (
                <button onClick={() => { setEntityType(''); setAction(''); setDateFrom(''); setDateTo(''); setPage(1); }} className="text-[12px] text-[#99A1B7] hover:text-[#F8285A] transition-colors flex items-center gap-1">
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  Clear
                </button>
              )}
              <span className="ml-auto text-[12px] text-[#99A1B7]">{total} entries</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E1E3EA]">
                  {['Timestamp', 'Action', 'Entity', 'Details', 'User', 'IP'].map(col => (
                    <th key={col} className="px-4 py-2.5 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#F1F1F4]">
                    {[120, 90, 80, 140, 100, 80].map((w, j) => (
                      <td key={j} className="px-4 py-3.5"><div className="skeleton h-3.5 rounded" style={{ width: w }} /></td>
                    ))}
                  </tr>
                ))}

                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-[13px] text-[#99A1B7]">
                      {hasFilters ? 'No audit entries match your filters' : 'No audit entries yet'}
                    </td>
                  </tr>
                )}

                {!loading && logs.map((log) => (
                  <tr key={log.id} className="border-b border-[#F1F1F4] hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3.5 text-[12px] text-[#4B5675]" title={new Date(log.createdAt).toLocaleString()}>
                      {timeAgo(log.createdAt)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium ${ACTION_COLORS[log.action] ?? 'bg-[#F9F9F9] text-[#78829D]'}`}>
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {log.entityId ? (
                        <button
                          onClick={() => {
                            if (log.entityType === 'media_plan') router.push(`/media-plans/${log.entityId}`);
                          }}
                          className="text-[12px] text-[#1B84FF] hover:text-[#056EE9] transition-colors"
                        >
                          {log.entityType.replace(/_/g, ' ')}
                        </button>
                      ) : (
                        <span className="text-[12px] text-[#99A1B7]">{log.entityType.replace(/_/g, ' ')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-[#071437] max-w-[200px] truncate">
                      {formatDetails(log)}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] text-[#4B5675]">
                      {log.userEmail ?? (log.userId ? 'System' : 'Anonymous')}
                    </td>
                    <td className="px-4 py-3.5 text-[11px] text-[#B5B5C3] font-mono">
                      {log.ipAddress ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-[#F1F1F4]">
              <span className="text-[12px] text-[#99A1B7]">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-[12px] border border-[#E1E3EA] rounded-md disabled:opacity-40 hover:bg-[#F9F9F9] transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-[12px] border border-[#E1E3EA] rounded-md disabled:opacity-40 hover:bg-[#F9F9F9] transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
