'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
          <NavLink href="/">Media Plans</NavLink>
          <NavLink href="/benchmarks">Benchmarks</NavLink>
        </nav>

        {/* Right: org + avatar */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-[#99A1B7] font-medium hidden sm:block">Jasmin Media</span>
          <div className="w-8 h-8 rounded-full bg-[#EEF6FF] border border-[#1B84FF]/20 flex items-center justify-center shrink-0">
            <span className="text-[#1B84FF] text-xs font-semibold">JM</span>
          </div>
        </div>
      </div>
    </header>
  );
}
