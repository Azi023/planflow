'use client';

import { use, useState } from 'react';
import MediaPlanBuilder from '@/components/media-plan-builder/MediaPlanBuilder';
import TestCalculator from '@/components/test-calculator/TestCalculator';
import { ActualsPanel } from '@/components/actuals/ActualsPanel';
import { PageHeader } from '@/components/PageHeader';

type View = 'builder' | 'actuals';

const TABS: { value: View; label: string }[] = [
  { value: 'builder', label: 'Plan Builder' },
  { value: 'actuals', label: 'Actuals & Performance' },
];

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditPlanPage({ params }: Props) {
  const { id } = use(params);
  const [view, setView] = useState<View>('builder');

  return (
    <>
      <PageHeader
        title="Media Plan"
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Media Plans', href: '/media-plans' },
          { label: 'Edit Plan' },
        ]}
        action={
          <div className="flex border border-[#E1E3EA] rounded-lg overflow-hidden">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setView(tab.value)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  view === tab.value
                    ? 'bg-[#1B84FF] text-white'
                    : 'bg-white text-[#4B5675] hover:bg-[#F9F9F9]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="p-8 space-y-6">
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
