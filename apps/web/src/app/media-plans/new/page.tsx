import MediaPlanBuilder from '@/components/media-plan-builder/MediaPlanBuilder';
import TestCalculator from '@/components/test-calculator/TestCalculator';

export default function NewPlanPage() {
  return (
    <main className="max-w-[1600px] mx-auto px-8 py-8 space-y-6">
      <div className="mb-1">
        <h1 className="text-2xl font-semibold text-[#071437] leading-tight">New Media Plan</h1>
        <p className="text-sm text-[#99A1B7] mt-1">Build a campaign plan and calculate projected KPIs</p>
      </div>
      <MediaPlanBuilder />
      <TestCalculator />
    </main>
  );
}
