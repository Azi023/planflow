'use client';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  draft: {
    label: 'Draft',
    bg: 'bg-[#F9F9F9]',
    text: 'text-[#78829D]',
    dot: 'bg-[#B5B5C3]',
  },
  pending_review: {
    label: 'Pending Review',
    bg: 'bg-[#FFF8DD]',
    text: 'text-[#E5AD00]',
    dot: 'bg-[#F6C000]',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-[#EAFFF1]',
    text: 'text-[#04B440]',
    dot: 'bg-[#17C653]',
  },
  sent: {
    label: 'Sent',
    bg: 'bg-[#EEF6FF]',
    text: 'text-[#1B84FF]',
    dot: 'bg-[#1B84FF]',
  },
  saved: {
    label: 'Saved',
    bg: 'bg-[#EEF6FF]',
    text: 'text-[#1B84FF]',
    dot: 'bg-[#1B84FF]',
  },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? 'draft';
  const config = STATUS_CONFIG[s] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
