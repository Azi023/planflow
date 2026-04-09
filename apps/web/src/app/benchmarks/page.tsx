import BenchmarkTable from '@/components/benchmark-table/BenchmarkTable';
import { PageHeader } from '@/components/PageHeader';

export default function BenchmarksPage() {
  return (
    <>
      <PageHeader
        title="KPI Benchmarks"
        subtitle="Reference rates for media planning · Double-click any cell to edit"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Benchmarks' }]}
      />
      <div className="p-6 lg:p-8">
        <BenchmarkTable />
      </div>
    </>
  );
}
