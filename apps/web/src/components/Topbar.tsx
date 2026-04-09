'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from './auth/AuthProvider';
import { useSidebar } from './Sidebar';
import { ROLE_LABELS } from '@/lib/auth';

interface TopbarProps {
  breadcrumbs?: { label: string; href?: string }[];
  title?: string;
}

export function Topbar({ breadcrumbs, title }: TopbarProps) {
  const { user, signOut } = useAuth();
  const { toggleMobile } = useSidebar();
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initials = user
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'JM';

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-8 bg-white border-b border-[#E1E3EA]"
      style={{ height: 64 }}
    >
      {/* Left: Hamburger + Breadcrumb */}
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <button
          onClick={toggleMobile}
          className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[#4B5675] hover:bg-[#F6F6F9] transition-colors mr-1"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5 text-[13px]">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && (
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 text-[#DBDFE9]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
                {crumb.href ? (
                  <a href={crumb.href} className="text-[#99A1B7] hover:text-[#1B84FF] transition-colors">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-[#071437] font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : title ? (
          <h1 className="text-[15px] font-semibold text-[#071437]">{title}</h1>
        ) : null}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-[#99A1B7] hover:text-[#071437] hover:bg-[#F6F6F9] transition-colors">
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#99A1B7] hover:text-[#071437] hover:bg-[#F6F6F9] transition-colors">
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F8285A]" />
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-[#E1E3EA] mx-1" />

        {/* User avatar + dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenu(v => !v)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#F6F6F9] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[#EEF6FF] border border-[#1B84FF]/20 flex items-center justify-center">
              <span className="text-[#1B84FF] text-[11px] font-semibold">{initials}</span>
            </div>
            {user && (
              <div className="hidden sm:block text-left">
                <div className="text-[13px] font-medium text-[#071437] leading-tight">{user.name}</div>
                <div className="text-[11px] text-[#99A1B7] leading-tight">{ROLE_LABELS[user.role] ?? user.role}</div>
              </div>
            )}
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#99A1B7]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {userMenu && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-lg border border-[#E1E3EA] py-1" style={{ boxShadow: '0px 10px 30px rgba(0,0,0,0.12)' }}>
              {user && (
                <div className="px-4 py-3 border-b border-[#F1F1F4]">
                  <div className="text-[13px] font-medium text-[#071437]">{user.name}</div>
                  <div className="text-[12px] text-[#99A1B7]">{user.email}</div>
                </div>
              )}
              <button
                onClick={() => { setUserMenu(false); signOut(); }}
                className="w-full text-left px-4 py-2.5 text-[13px] text-[#F8285A] hover:bg-[#FFEEF3] transition-colors flex items-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
