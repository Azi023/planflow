'use client';

import { useEffect, useState } from 'react';
import type { MediaPlan } from '@/lib/types';
import type { CampaignActual } from '@/lib/api';
import { fetchPlanGroup, fetchActuals } from '@/lib/api';
import { ActualsQuickForm } from './ActualsQuickForm';
import { ActualsBulkPaste } from './ActualsBulkPaste';
import { ActualsComparison } from './ActualsComparison';

interface Props {
  groupId: string;
}

type InputMode = 'quick' | 'bulk';

export function ActualsPanel({ groupId }: Props) {
  const [plans, setPlans] = useState<MediaPlan[]>([]);
  const [actuals, setActuals] = useState<CampaignActual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>('quick');

  useEffect(() => {
    fetchPlanGroup(groupId)
      .then((group) => {
        setPlans(group);
        if (group.length > 0) setActivePlanId(group[0].id);
      })
      .catch(() => setError('Failed to load plan data'))
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    if (!activePlanId) return;
    fetchActuals(activePlanId).then(setActuals).catch(() => {});
  }, [activePlanId]);

  const refreshActuals = () => {
    if (activePlanId) {
      fetchActuals(activePlanId).then(setActuals).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[#99A1B7]">
        Loading plan data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#FFEEF3] border border-[#F8285A]/20 rounded-lg px-4 py-3 text-sm text-[#F8285A]">
        {error}
      </div>
    );
  }

  const activePlan = plans.find((p) => p.id === activePlanId);
  const planRows = activePlan?.rows ?? [];

  return (
    <div className="space-y-6">
      {/* Variant picker — shown only when multiple variants exist */}
      {plans.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-[#4B5675]">Variant:</span>
          <div className="flex gap-2">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => setActivePlanId(p.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activePlanId === p.id
                    ? 'bg-[#1B84FF] text-white'
                    : 'bg-[#F1F1F4] text-[#4B5675] hover:bg-[#E1E3EA]'
                }`}
              >
                {p.variantName}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input card */}
      <div className="bg-white rounded-[8px] border border-[#E1E3EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="px-6 pt-5 pb-4 border-b border-[#E1E3EA] flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#071437]">Enter Actuals</p>
            <p className="text-xs text-[#99A1B7] mt-0.5">
              Record real campaign performance data
            </p>
          </div>
          {/* Mode toggle */}
          <div className="flex rounded-md border border-[#E1E3EA] overflow-hidden text-xs font-medium">
            <button
              onClick={() => setInputMode('quick')}
              className={`px-3 py-1.5 transition-colors ${
                inputMode === 'quick'
                  ? 'bg-[#1B84FF] text-white'
                  : 'bg-white text-[#4B5675] hover:bg-[#F1F1F4]'
              }`}
            >
              Quick Form
            </button>
            <button
              onClick={() => setInputMode('bulk')}
              className={`px-3 py-1.5 border-l border-[#E1E3EA] transition-colors ${
                inputMode === 'bulk'
                  ? 'bg-[#1B84FF] text-white'
                  : 'bg-white text-[#4B5675] hover:bg-[#F1F1F4]'
              }`}
            >
              Bulk Paste
            </button>
          </div>
        </div>

        <div className="p-6">
          {activePlanId && inputMode === 'quick' && (
            <ActualsQuickForm
              planId={activePlanId}
              planRows={planRows}
              currency={activePlan?.currency ?? 'LKR'}
              onSaved={refreshActuals}
            />
          )}
          {activePlanId && inputMode === 'bulk' && (
            <ActualsBulkPaste
              planId={activePlanId}
              planRows={planRows}
              onSaved={refreshActuals}
            />
          )}
        </div>
      </div>

      {/* Comparison */}
      {activePlanId && (
        <ActualsComparison
          planRows={planRows}
          actuals={actuals}
          currency={activePlan?.currency ?? 'LKR'}
        />
      )}
    </div>
  );
}
