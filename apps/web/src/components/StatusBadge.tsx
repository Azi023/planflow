'use client';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  draft: {
    label: 'Draft',
    bg: 'bg-[#F9F9F9]',
    text: 'text-[#99A1B7]',
    border: 'border-[#E1E3EA]',
  },
  pending_review: {
    label: 'Pending Review',
    bg: 'bg-[#FFF8DD]',
    text: 'text-[#F6B100]',
    border: 'border-[#F6B100]/20',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-[#DFFFEA]',
    text: 'text-[#17C653]',
    border: 'border-[#17C653]/20',
  },
  sent: {
    label: 'Sent to Client',
    bg: 'bg-[#EEF6FF]',
    text: 'text-[#1B84FF]',
    border: 'border-[#1B84FF]/20',
  },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? 'draft';
  const config = STATUS_CONFIG[s] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border ${config.bg} ${config.text} ${config.border}`}
    >
      {config.label}
    </span>
  );
}
