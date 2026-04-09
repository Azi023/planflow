'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MediaPlanBuilder from '@/components/media-plan-builder/MediaPlanBuilder';
import TestCalculator from '@/components/test-calculator/TestCalculator';
import { ActualsPanel } from '@/components/actuals/ActualsPanel';
import { PageHeader } from '@/components/PageHeader';
import { VersionHistoryDrawer } from '@/components/version-history/VersionHistoryDrawer';
import { fetchPlanGroup } from '@/lib/api';
import type { MediaPlan } from '@/lib/types';

type View = 'builder' | 'actuals';

const TABS: { value: View; label: string; icon: string }[] = [
  { value: 'builder', label: 'Plan Builder', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6' },
  { value: 'actuals', label: 'Actuals & Performance', icon: 'M22 12h-4l-3 9L9 3l-3 9H2' },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditPlanPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [view, setView] = useState<View>('builder');
  const [planName, setPlanName] = useState<string | null>(null);
  const [isHistorical, setIsHistorical] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetchPlanGroup(id).then((plans: MediaPlan[]) => {
      const plan = plans[0];
      if (plan) {
        setPlanName(plan.campaignName ?? plan.referenceNumber ?? null);
        const historical = !!plan.campaignName?.includes('Meta Historical Actuals');
        setIsHistorical(historical);
        if (historical || (!plan.rows || plan.rows.length === 0) && plan.campaignName?.includes('Meta Historical Actuals')) {
          setView('actuals');
        }
      }
    }).catch(() => {});
  }, [id]);

  const breadcrumbLabel = planName
    ? (planName.length > 40 ? planName.slice(0, 40) + '...' : planName)
    : 'Edit Plan';

  return (
    <>
      <PageHeader
        title={planName ?? 'Media Plan'}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Media Plans', href: '/media-plans' },
          { label: breadcrumbLabel },
        ]}
        action={
          <div className="flex items-center gap-2">
            {/* History button */}
            <button
              onClick={() => setShowHistory(true)}
              className="w-9 h-9 rounded-lg flex items-center justify-center border border-[#DBDFE9] text-[#4B5675] hover:bg-[#F6F6F9] transition-colors"
              title="Version History"
            >
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </button>

            {/* View tabs */}
            <div className="flex rounded-lg overflow-hidden border border-[#DBDFE9]">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setView(tab.value)}
                  disabled={isHistorical && tab.value === 'builder'}
                  title={isHistorical && tab.value === 'builder' ? 'This is a historical data container' : undefined}
                  className={`px-4 py-2 text-[13px] font-medium transition-all flex items-center gap-2 ${
                    view === tab.value
                      ? 'bg-[#1B84FF] text-white'
                      : 'bg-white text-[#4B5675] hover:bg-[#F6F6F9]'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d={tab.icon} />
                  </svg>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {view === 'builder' && !isHistorical && (
          <>
            <MediaPlanBuilder groupId={id} />
            <TestCalculator />
          </>
        )}

        {view === 'builder' && isHistorical && (
          <div className="card p-8 text-center">
            <div className="text-4xl mb-3">📦</div>
            <h3 className="text-[15px] font-semibold text-[#071437] mb-1">Historical Data Container</h3>
            <p className="text-[13px] text-[#99A1B7] mb-4">This plan was imported from Meta CSV data and contains campaign actuals only.</p>
            <button
              onClick={() => setView('actuals')}
              className="inline-flex items-center gap-2 bg-[#1B84FF] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg hover:bg-[#056EE9] transition-colors"
            >
              View Actuals &rarr;
            </button>
          </div>
        )}

        {view === 'actuals' && <ActualsPanel groupId={id} />}
      </div>

      {/* Version History Drawer */}
      {showHistory && (
        <VersionHistoryDrawer
          planId={id}
          onClose={() => setShowHistory(false)}
          onRestored={() => router.refresh()}
        />
      )}
    </>
  );
}
