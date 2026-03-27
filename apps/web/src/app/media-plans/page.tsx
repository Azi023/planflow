'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchPlans, deletePlan, duplicatePlan } from '@/lib/api';
import type { MediaPlan } from '@/lib/types';
import { StatusBadge } from '@/components/StatusBadge';
import { useAuth } from '@/components/auth/AuthProvider';

function SkeletonRow() {
  return (
    <tr className="border-b border-[#F1F1F4]">
      {[140, 200, 100, 100, 100, 80, 60, 80].map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <div className="skeleton h-3.5 rounded" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

export default function PlansListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [plans, setPlans] = useState<MediaPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchPlans()
      .then(setPlans)
      .catch(() => setError('Failed to load plans'))
      .finally(() => setLoading(false));
  }, []);

  // Deduplicate by variantGroupId — show one row per group (the first/primary variant)
  const groups = Object.values(
    plans.reduce<Record<string, MediaPlan>>((acc, p) => {
      const key = p.variantGroupId ?? p.id;
      if (!acc[key]) acc[key] = p;
      return acc;
    }, {})
  ).sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const handleDuplicate = async (plan: MediaPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    setDuplicatingId(plan.id);
    try {
      const result = await duplicatePlan(plan.id);
      const newGroupId = result.variantGroupId ?? result.id;
      router.push(`/media-plans/${newGroupId}`);
    } catch {
      alert('Failed to duplicate plan');
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (plan: MediaPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this plan?')) return;
    try {
      await deletePlan(plan.id);
      setPlans((ps) => ps.filter((p) => p.variantGroupId !== (plan.variantGroupId ?? plan.id)));
    } catch {
      alert('Failed to delete');
    }
  };

  return (
    <main className="max-w-[1280px] mx-auto px-8 py-8">
      {/* Page header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-2xl font-semibold text-[#071437] leading-tight">Media Plans</h1>
          <p className="text-sm text-[#99A1B7] mt-1">Manage and build client media plans</p>
        </div>
        <button
          onClick={() => router.push('/media-plans/new')}
          className="bg-[#1B84FF] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#056EE9] transition-colors flex items-center gap-2 shadow-sm"
        >
          <span className="text-base leading-none">+</span>
          New Plan
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#FFEEF3] border border-[#F8285A]/20 rounded-lg px-4 py-3 text-sm text-[#F8285A] mb-4">
          {error}
        </div>
      )}

      {/* Table card */}
      <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-[#F1F1F4] flex items-center justify-between">
          <p className="text-sm font-semibold text-[#071437]">
            {loading ? 'Loading…' : `${groups.length} plan${groups.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F9F9F9] border-b border-[#E1E3EA]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider w-28">Ref #</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Campaign</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Product</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Budget</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left w-24 text-[11px] font-semibold text-[#99A1B7] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && groups.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[#F9F9F9] border border-[#E1E3EA] flex items-center justify-center text-xl">
                        📋
                      </div>
                      <p className="text-sm font-medium text-[#4B5675]">No media plans yet</p>
                      <p className="text-xs text-[#99A1B7]">Create your first plan to get started</p>
                      <button
                        onClick={() => router.push('/media-plans/new')}
                        className="mt-1 bg-[#1B84FF] text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-[#056EE9] transition-colors"
                      >
                        Create first plan
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!loading && groups.map((plan) => (
                <tr
                  key={plan.variantGroupId ?? plan.id}
                  onClick={() => router.push(`/media-plans/${plan.variantGroupId ?? plan.id}`)}
                  className="border-b border-[#F1F1F4] hover:bg-[#F9F9F9] cursor-pointer transition-colors last:border-0"
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-[#99A1B7]">
                    {plan.referenceNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-[#071437]">
                    {plan.campaignName ?? <span className="text-[#99A1B7] italic font-normal">Untitled</span>}
                  </td>
                  <td className="px-4 py-3.5 text-[#4B5675] text-sm">{plan.client?.name ?? '—'}</td>
                  <td className="px-4 py-3.5 text-[#4B5675] text-sm">{plan.product?.name ?? '—'}</td>
                  <td className="px-4 py-3.5 text-[#4B5675] text-sm tabular-nums">
                    {plan.totalBudget
                      ? `${plan.currency} ${Number(plan.totalBudget).toLocaleString()}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3.5 text-[#99A1B7] text-xs">
                    {plan.createdAt ? new Date(plan.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={plan.status} />
                  </td>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => router.push(`/media-plans/${plan.variantGroupId ?? plan.id}`)}
                        className="text-[#1B84FF] hover:text-[#056EE9] text-xs font-medium transition-colors"
                      >
                        Edit
                      </button>
                      <span className="text-[#E1E3EA]">·</span>
                      <button
                        onClick={(e) => handleDuplicate(plan, e)}
                        disabled={duplicatingId === plan.id}
                        className="text-[#7239EA] hover:text-[#5A2DB5] text-xs font-medium transition-colors disabled:opacity-60"
                      >
                        {duplicatingId === plan.id ? 'Copying…' : 'Duplicate'}
                      </button>
                      {isAdmin && (
                        <>
                          <span className="text-[#E1E3EA]">·</span>
                          <button
                            onClick={(e) => handleDelete(plan, e)}
                            className="text-[#99A1B7] hover:text-[#F8285A] text-xs transition-colors"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
