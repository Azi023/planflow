'use client';

import { useEffect, useState } from 'react';
import { fetchPlanVersions, restorePlanVersion } from '@/lib/api';
import type { PlanVersion } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthProvider';

const CHANGE_ICONS: Record<string, string> = {
  created: 'M12 5v14M5 12h14',
  rows_updated: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7',
  status_changed: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z',
  exported: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  shared: 'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  duplicated: 'M20 9v11a2 2 0 01-2 2H8a2 2 0 01-2-2V9M16 1H4a2 2 0 00-2 2v13',
  restored: 'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 105.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15',
  manual_save: 'M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z',
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
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface Props {
  planId: string;
  onClose: () => void;
  onRestored: () => void;
}

export function VersionHistoryDrawer({ planId, onClose, onRestored }: Props) {
  const { user } = useAuth();
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState<PlanVersion | null>(null);
  const canRestore = user?.role === 'admin' || user?.role === 'planner';

  useEffect(() => {
    fetchPlanVersions(planId)
      .then(setVersions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [planId]);

  const handleRestore = async (v: PlanVersion) => {
    if (!confirm(`Restore to version ${v.versionNumber}? This will replace current plan rows.`)) return;
    setRestoring(v.id);
    try {
      await restorePlanVersion(planId, v.id);
      onRestored();
      onClose();
    } catch {
      alert('Failed to restore version');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 flex flex-col" style={{ boxShadow: '-10px 0 30px rgba(0,0,0,0.1)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F1F4]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#071437]">Version History</h2>
            <p className="text-[12px] text-[#99A1B7] mt-0.5">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#99A1B7] hover:text-[#071437] hover:bg-[#F6F6F9] transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-20 rounded-lg" />
              ))}
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div className="text-center py-12">
              <svg viewBox="0 0 24 24" className="w-10 h-10 mx-auto text-[#DBDFE9] mb-3" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              <p className="text-[13px] text-[#99A1B7]">No version history yet</p>
              <p className="text-[12px] text-[#B5B5C3] mt-1">Versions are created automatically when you save changes</p>
            </div>
          )}

          {!loading && versions.map((v, idx) => (
            <div key={v.id} className={`border border-[#F1F1F4] rounded-lg p-4 mb-3 transition-colors ${idx === 0 ? 'bg-[#FAFAFA]' : 'hover:bg-[#FAFAFA]'}`}>
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-8 h-8 rounded-lg bg-[#EEF6FF] flex items-center justify-center shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#1B84FF]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d={CHANGE_ICONS[v.changeType] ?? CHANGE_ICONS.manual_save} />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-[#1B84FF] bg-[#EEF6FF] px-2 py-0.5 rounded-full">v{v.versionNumber}</span>
                    {idx === 0 && <span className="text-[10px] font-semibold text-[#17C653] bg-[#EAFFF1] px-2 py-0.5 rounded-full">Current</span>}
                  </div>

                  {/* Summary */}
                  <p className="text-[13px] text-[#071437] font-medium">{v.changeSummary ?? v.changeType.replace(/_/g, ' ')}</p>

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#99A1B7]">
                    <span>{timeAgo(v.createdAt)}</span>
                    {v.createdBy && <span>{v.createdBy.includes('@') ? v.createdBy.split('@')[0] : v.createdBy}</span>}
                  </div>

                  {/* Actions */}
                  {idx > 0 && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        onClick={() => setPreviewVersion(v)}
                        className="text-[11px] font-medium text-[#1B84FF] hover:text-[#056EE9] transition-colors"
                      >
                        Preview
                      </button>
                      {canRestore && (
                        <>
                          <span className="text-[#E1E3EA]">·</span>
                          <button
                            onClick={() => handleRestore(v)}
                            disabled={restoring === v.id}
                            className="text-[11px] font-medium text-[#7239EA] hover:text-[#5B21D1] transition-colors disabled:opacity-50"
                          >
                            {restoring === v.id ? 'Restoring...' : 'Restore'}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Modal */}
      {previewVersion && (
        <SnapshotPreviewModal version={previewVersion} onClose={() => setPreviewVersion(null)} />
      )}
    </>
  );
}

function SnapshotPreviewModal({ version, onClose }: { version: PlanVersion; onClose: () => void }) {
  const snapshot = version.snapshot as Record<string, unknown>;
  const rows = (snapshot.rows ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/50" />
      <div className="relative bg-white rounded-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()} style={{ boxShadow: '0px 10px 30px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F1F4] bg-[#EEF6FF]">
          <div>
            <h3 className="text-[14px] font-semibold text-[#071437]">
              Version {version.versionNumber} Snapshot
            </h3>
            <p className="text-[12px] text-[#4B5675] mt-0.5">
              {version.changeSummary} · {new Date(version.createdAt).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4B5675] hover:bg-white/50 transition-colors">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        {/* Plan info */}
        <div className="px-6 py-3 border-b border-[#F1F1F4] bg-[#FAFAFA] text-[12px] text-[#4B5675] flex gap-6">
          {snapshot.campaignName ? <span><strong>Campaign:</strong> {String(snapshot.campaignName)}</span> : null}
          {snapshot.totalBudget ? <span><strong>Budget:</strong> {String(snapshot.currency ?? 'LKR')} {Number(snapshot.totalBudget).toLocaleString()}</span> : null}
          {snapshot.status ? <span><strong>Status:</strong> {String(snapshot.status)}</span> : null}
        </div>

        {/* Rows table */}
        <div className="flex-1 overflow-auto">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[#99A1B7]">No rows in this snapshot</div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[#F9F9F9] border-b border-[#E1E3EA]">
                  {['#', 'Platform', 'Objective', 'Audience', 'Budget', 'Creative'].map(col => (
                    <th key={col} className="px-3 py-2 text-left text-[10px] font-semibold text-[#99A1B7] uppercase tracking-wider">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#F1F1F4] hover:bg-[#FAFAFA]">
                    <td className="px-3 py-2 text-[#99A1B7]">{i + 1}</td>
                    <td className="px-3 py-2 text-[#071437] font-medium">{String(row.platform ?? '—')}</td>
                    <td className="px-3 py-2 text-[#4B5675]">{String(row.objective ?? '—')}</td>
                    <td className="px-3 py-2 text-[#4B5675]">{String(row.audienceName ?? row.audienceType ?? '—')}</td>
                    <td className="px-3 py-2 text-[#071437] tabular-nums">{row.budget ? Number(row.budget).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2 text-[#4B5675]">{String(row.creative ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
