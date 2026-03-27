'use client';

import { use, useState } from 'react';
import MediaPlanBuilder from '@/components/media-plan-builder/MediaPlanBuilder';
import TestCalculator from '@/components/test-calculator/TestCalculator';
import { ActualsPanel } from '@/components/actuals/ActualsPanel';

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
    <main className="max-w-[1600px] mx-auto px-8 py-8 space-y-6">
      {/* View tab bar */}
      <div className="flex border-b border-[#E1E3EA] -mb-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setView(tab.value)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              view === tab.value
                ? 'border-[#1B84FF] text-[#1B84FF]'
                : 'border-transparent text-[#99A1B7] hover:text-[#4B5675]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === 'builder' && (
        <>
          <MediaPlanBuilder groupId={id} />
          <TestCalculator />
        </>
      )}

      {view === 'actuals' && <ActualsPanel groupId={id} />}
    </main>
  );
}
