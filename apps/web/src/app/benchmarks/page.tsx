import BenchmarkTable from '@/components/benchmark-table/BenchmarkTable';
import { PageHeader } from '@/components/PageHeader';

export default function BenchmarksPage() {
  return (
    <>
      <PageHeader
        title="KPI Benchmarks"
        subtitle="Reference rates for media planning · Double-click any cell to edit"
        breadcrumbs={[{ label: 'Home' }, { label: 'Benchmarks' }]}
      />
      <div className="p-8">
        <BenchmarkTable />
      </div>
    </>
  );
}
