import MediaPlanBuilder from '@/components/media-plan-builder/MediaPlanBuilder';
import TestCalculator from '@/components/test-calculator/TestCalculator';
import { PageHeader } from '@/components/PageHeader';

export default function NewPlanPage() {
  return (
    <>
      <PageHeader
        title="New Media Plan"
        subtitle="Build a campaign plan and calculate projected KPIs"
        breadcrumbs={[
          { label: 'Home' },
          { label: 'Media Plans', href: '/media-plans' },
          { label: 'New Plan' },
        ]}
      />
      <div className="p-8 space-y-6">
        <MediaPlanBuilder />
        <TestCalculator />
      </div>
    </>
  );
}
