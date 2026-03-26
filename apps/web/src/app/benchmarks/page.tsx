import BenchmarkTable from '@/components/benchmark-table/BenchmarkTable';

export default function BenchmarksPage() {
  return (
    <main className="max-w-[1600px] mx-auto px-8 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-semibold text-[#071437] leading-tight">KPI Benchmarks</h1>
        <p className="text-sm text-[#99A1B7] mt-1">
          Reference rates for media planning · Double-click any cell to edit
        </p>
      </div>
      <BenchmarkTable />
    </main>
  );
}
