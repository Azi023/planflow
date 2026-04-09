'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, createContext, useContext } from 'react';
import { useAuth } from './auth/AuthProvider';
import { ROLE_LABELS } from '@/lib/auth';

/* ── Sidebar collapse context ─────────────────────────────────── */
const SidebarContext = createContext({ collapsed: false, mobileOpen: false, toggle: () => {}, toggleMobile: () => {} });
export function useSidebar() { return useContext(SidebarContext); }

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{
      collapsed,
      mobileOpen,
      toggle: () => setCollapsed(v => !v),
      toggleMobile: () => setMobileOpen(v => !v),
    }}>
      {children}
    </SidebarContext.Provider>
  );
}

/* ── Icons ─────────────────────────────────────────────────────── */
function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ width: size, height: size, flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  plans: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  templates: 'M5 2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4a2 2 0 012-2zM9 7h6M9 11h6M9 15h3',
  calculator: 'M4 2h16a2 2 0 012 2v16a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2zM8 10h8M8 14h8M8 18h4',
  benchmarks: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  clients: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  analytics: 'M18 20V10M12 20V4M6 20v-6M2 20h20',
  actuals: 'M22 12h-4l-3 9L9 3l-3 9H2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  collapse: 'M11 19l-7-7 7-7M18 19l-7-7 7-7',
  expand: 'M13 5l7 7-7 7M6 5l7 7-7 7',
  signout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
} as const;

/* ── Nav config ────────────────────────────────────────────────── */
interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'MAIN',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
    ],
  },
  {
    title: 'PLANNING',
    items: [
      { href: '/media-plans', label: 'Media Plans', icon: 'plans' },
      { href: '/templates', label: 'Templates', icon: 'templates' },
    ],
  },
  {
    title: 'DATA',
    items: [
      { href: '/benchmarks', label: 'Benchmarks', icon: 'benchmarks' },
      { href: '/analytics', label: 'Analytics', icon: 'analytics' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { collapsed, toggle, mobileOpen, toggleMobile } = useSidebar();

  if (pathname === '/login' || pathname.startsWith('/shared/')) return null;

  const initials = user
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'JM';

  const w = collapsed ? 80 : 264;

  return (
    <>
    {/* Mobile overlay */}
    {mobileOpen && (
      <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={toggleMobile} />
    )}
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col transition-sidebar overflow-hidden ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
      style={{ width: w, backgroundColor: '#1C2135' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 shrink-0 h-16 border-b border-white/10">
        <div className="w-9 h-9 bg-[#1B84FF] rounded-xl flex items-center justify-center shrink-0">
          <span className="text-white text-[13px] font-bold tracking-tight">PF</span>
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-white font-semibold text-[15px]">Plan</span>
            <span className="text-[#1B84FF] font-semibold text-[15px]">Flow</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed && (
              <p className="text-[10px] font-semibold text-[#78829D] uppercase tracking-wider px-4 pb-2 mt-2 mb-1">
                {group.title}
              </p>
            )}
            {collapsed && <div className="h-px bg-white/10 mx-2 mb-2" />}
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon }) => {
                const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={`relative flex items-center gap-3 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                      collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-[#1B84FF]/15 text-white'
                        : 'text-[#99A1B7] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[#1B84FF]" />}
                    <Icon d={ICONS[icon]} />
                    {!collapsed && <span className="flex-1 truncate">{label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: collapse toggle + user */}
      <div className="shrink-0 border-t border-white/10">
        {/* User */}
        {user && (
          <div className={`px-4 py-3 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-[#1B84FF]/20 flex items-center justify-center shrink-0">
              <span className="text-[#1B84FF] text-[11px] font-semibold">{initials}</span>
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-white truncate leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[11px] text-[#78829D] leading-tight mt-px">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </div>
                </div>
                <button
                  onClick={signOut}
                  className="text-[#78829D] hover:text-[#F8285A] transition-colors p-1 rounded"
                  title="Sign out"
                >
                  <Icon d={ICONS.signout} size={16} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={toggle}
          className="w-full flex items-center justify-center py-3 text-[#78829D] hover:text-white transition-colors border-t border-white/10"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon d={collapsed ? ICONS.expand : ICONS.collapse} size={16} />
        </button>
      </div>
    </aside>
    </>
  );
}
