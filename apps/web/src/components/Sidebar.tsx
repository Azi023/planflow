'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth/AuthProvider';
import { ROLE_LABELS } from '@/lib/auth';

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconPlans() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function IconTemplates() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="12" y2="15" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  );
}

function IconBenchmarks() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px] shrink-0">
      <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px] shrink-0">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', Icon: IconDashboard },
  { href: '/media-plans', label: 'Media Plans', Icon: IconPlans },
  { href: '/templates', label: 'Templates', Icon: IconTemplates },
  { href: '/analytics', label: 'Analytics', Icon: IconAnalytics },
  { href: '/benchmarks', label: 'Benchmarks', Icon: IconBenchmarks },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  if (pathname === '/login' || pathname.startsWith('/shared/')) return null;

  const initials = user
    ? user.name
        .split(' ')
        .map((w: string) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'JM';

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white"
      style={{ width: 260, borderRight: '1px solid #E1E3EA' }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-6 shrink-0"
        style={{ height: 70, borderBottom: '1px solid #E1E3EA' }}
      >
        <div className="w-9 h-9 bg-[#1B84FF] rounded-xl flex items-center justify-center shadow-sm shrink-0">
          <span className="text-white text-[13px] font-bold tracking-tight">PF</span>
        </div>
        <div>
          <div className="font-semibold text-[#071437] text-[15px] leading-tight">PlanFlow</div>
          <div className="text-[10px] text-[#99A1B7] leading-tight mt-px">Media Planning</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-0.5">
        <p className="text-[10px] font-semibold text-[#99A1B7] uppercase tracking-widest px-3 pb-2">
          Menu
        </p>
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive =
            pathname === href ||
            (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-[10px] rounded-lg text-[13.5px] font-medium transition-colors duration-100 ${
                isActive
                  ? 'bg-[#EEF6FF] text-[#1B84FF]'
                  : 'text-[#4B5675] hover:bg-[#F9F9F9] hover:text-[#071437]'
              }`}
            >
              <Icon />
              <span className="flex-1">{label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#1B84FF] shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      {user && (
        <div className="shrink-0 px-4 py-4" style={{ borderTop: '1px solid #E1E3EA' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#EEF6FF] border border-[#1B84FF]/20 flex items-center justify-center shrink-0">
              <span className="text-[#1B84FF] text-[11px] font-semibold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-[#071437] truncate leading-tight">
                {user.name}
              </div>
              <div className="text-[11px] text-[#99A1B7] leading-tight mt-px">
                {ROLE_LABELS[user.role] ?? user.role}
              </div>
            </div>
            <button
              onClick={signOut}
              className="text-[#99A1B7] hover:text-[#F8285A] transition-colors p-1 rounded"
              title="Sign out"
            >
              <IconSignOut />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
