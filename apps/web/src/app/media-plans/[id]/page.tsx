'use client';

import { use, useEffect, useState } from 'react';
import MediaPlanBuilder from '@/components/media-plan-builder/MediaPlanBuilder';
import TestCalculator from '@/components/test-calculator/TestCalculator';
import { ActualsPanel } from '@/components/actuals/ActualsPanel';
import { PageHeader } from '@/components/PageHeader';
import { fetchPlanGroup } from '@/lib/api';

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
  const [view, setView] = useState<View>('builder');

  useEffect(() => {
    fetchPlanGroup(id).then((plans) => {
      const plan = plans[0];
      if (plan && (!plan.rows || plan.rows.length === 0) && plan.campaignName?.includes('Meta Historical Actuals')) {
        setView('actuals');
      }
    }).catch(() => {});
  }, [id]);

  return (
    <>
      <PageHeader
        title="Media Plan"
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Media Plans', href: '/media-plans' },
          { label: 'Edit Plan' },
        ]}
        action={
          <div className="flex rounded-lg overflow-hidden border border-[#DBDFE9]">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setView(tab.value)}
                className={`px-4 py-2 text-[13px] font-medium transition-all flex items-center gap-2 ${
                  view === tab.value
                    ? 'bg-[#1B84FF] text-white'
                    : 'bg-white text-[#4B5675] hover:bg-[#F6F6F9]'
                }`}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {view === 'builder' && (
          <>
            <MediaPlanBuilder groupId={id} />
            <TestCalculator />
          </>
        )}

        {view === 'actuals' && <ActualsPanel groupId={id} />}
      </div>
    </>
  );
}
