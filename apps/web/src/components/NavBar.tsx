'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth/AuthProvider';
import { ROLE_LABELS } from '@/lib/auth';

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`relative text-sm font-medium px-1 py-5 transition-colors ${
        isActive
          ? 'text-[#1B84FF]'
          : 'text-[#4B5675] hover:text-[#071437]'
      }`}
    >
      {children}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1B84FF] rounded-t-sm" />
      )}
    </Link>
  );
}

export function NavBar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  if (pathname === '/login' || pathname.startsWith('/shared/')) return null;

  const initials = user
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'JM';

  return (
    <header className="bg-white border-b border-[#E1E3EA] sticky top-0 z-50" style={{ height: 64 }}>
      <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-[#1B84FF] rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold tracking-tight">PF</span>
          </div>
          <span className="font-semibold text-[#071437] text-[15px]">PlanFlow</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-6 h-full">
          <NavLink href="/dashboard">Dashboard</NavLink>
          <NavLink href="/media-plans">Media Plans</NavLink>
          <NavLink href="/templates">Templates</NavLink>
          <NavLink href="/benchmarks">Benchmarks</NavLink>
        </nav>

        {/* Right: user info + sign out */}
        <div className="ml-auto flex items-center gap-3">
          {user && (
            <>
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-sm font-medium text-[#071437] leading-tight">
                  {user.name}
                </span>
                <span className="text-xs text-[#99A1B7]">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#EEF6FF] border border-[#1B84FF]/20 flex items-center justify-center shrink-0">
                <span className="text-[#1B84FF] text-xs font-semibold">{initials}</span>
              </div>
              <button
                onClick={signOut}
                className="text-xs font-medium text-[#99A1B7] hover:text-[#F8285A] transition-colors ml-1"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
