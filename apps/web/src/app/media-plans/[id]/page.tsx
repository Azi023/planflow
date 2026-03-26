'use client';

import { use } from 'react';
import MediaPlanBuilder from '@/components/media-plan-builder/MediaPlanBuilder';
import TestCalculator from '@/components/test-calculator/TestCalculator';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditPlanPage({ params }: Props) {
  const { id } = use(params);
  return (
    <main className="max-w-[1600px] mx-auto px-8 py-8 space-y-6">
      <MediaPlanBuilder groupId={id} />
      <TestCalculator />
    </main>
  );
}
