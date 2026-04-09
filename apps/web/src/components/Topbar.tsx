'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './auth/AuthProvider';
import { useSidebar } from './Sidebar';
import { ROLE_LABELS } from '@/lib/auth';
import { fetchPlans } from '@/lib/api';
import { StatusBadge } from './StatusBadge';

/* ── Search Modal ──────────────────────────────────────────────── */

function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{
    id: string; campaignName: string | null; client?: { name: string } | null;
    referenceNumber?: string | null; status: string; variantGroupId?: string | null;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const plans = await fetchPlans({ search: query.trim(), limit: 8 });
        setResults(plans);
        setActiveIdx(0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const navigate = useCallback((plan: typeof results[0]) => {
    const id = plan.variantGroupId ?? plan.id;
    router.push(`/media-plans/${id}`);
    onClose();
  }, [router, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[activeIdx]) { navigate(results[activeIdx]); }
    else if (e.key === 'Escape') { onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-[560px] bg-white rounded-xl border border-[#E1E3EA] overflow-hidden mx-4"
        style={{ boxShadow: '0px 10px 30px rgba(0,0,0,0.12)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 border-b border-[#F1F1F4]">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#99A1B7] shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search plans, clients, references..."
            className="flex-1 py-4 text-[15px] text-[#071437] placeholder-[#B5B5C3] outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-[#DBDFE9] bg-[#F9F9F9] text-[10px] font-medium text-[#99A1B7]">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto">
          {!query.trim() && (
            <div className="px-5 py-8 text-center text-[13px] text-[#99A1B7]">
              Type to search plans, clients, or references...
            </div>
          )}
          {query.trim() && loading && (
            <div className="px-5 py-6 text-center text-[13px] text-[#99A1B7]">Searching...</div>
          )}
          {query.trim() && !loading && results.length === 0 && (
            <div className="px-5 py-6 text-center text-[13px] text-[#99A1B7]">No results found</div>
          )}
          {results.map((plan, i) => (
            <button
              key={plan.id}
              onClick={() => navigate(plan)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                i === activeIdx ? 'bg-[#F6F6F9]' : 'hover:bg-[#FAFAFA]'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-[#071437] truncate">
                  {plan.campaignName ?? plan.referenceNumber ?? 'Untitled'}
                </div>
                <div className="text-[12px] text-[#99A1B7] truncate">
                  {[plan.client?.name, plan.referenceNumber].filter(Boolean).join(' · ')}
                </div>
              </div>
              <StatusBadge status={plan.status} />
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="px-5 py-2.5 border-t border-[#F1F1F4] flex items-center gap-4 text-[11px] text-[#99A1B7]">
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-[#DBDFE9] bg-[#F9F9F9] text-[10px]">&uarr;&darr;</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded border border-[#DBDFE9] bg-[#F9F9F9] text-[10px]">&crarr;</kbd> Open</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Notification Dropdown ─────────────────────────────────────── */

const PLACEHOLDER_NOTIFICATIONS = [
  { id: '1', icon: '📤', message: 'Plan JM-2026-001 was sent to client', time: '3h ago' },
  { id: '2', icon: '📋', message: 'New template "Banking Awareness" created', time: '3h ago' },
  { id: '3', icon: '📊', message: 'Benchmark confidence scores updated', time: '1d ago' },
];

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState(PLACEHOLDER_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-2 w-[360px] bg-white rounded-xl border border-[#E1E3EA] overflow-hidden" style={{ boxShadow: '0px 10px 30px rgba(0,0,0,0.12)' }}>
      <div className="px-4 py-3 border-b border-[#F1F1F4] flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[#071437]">Notifications</span>
        {items.length > 0 && (
          <span className="text-[11px] font-medium text-[#1B84FF] bg-[#EEF6FF] px-2 py-0.5 rounded-full">{items.length} new</span>
        )}
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        {items.length === 0 && (
          <div className="py-8 text-center text-[13px] text-[#99A1B7]">No new notifications</div>
        )}
        {items.map((n) => (
          <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#FAFAFA] transition-colors border-b border-[#F1F1F4] last:border-0">
            <span className="text-base mt-0.5">{n.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#071437] leading-snug">{n.message}</p>
              <p className="text-[11px] text-[#99A1B7] mt-0.5">{n.time}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="px-4 py-2.5 border-t border-[#F1F1F4] flex items-center justify-between">
        <button onClick={() => setItems([])} className="text-[12px] text-[#99A1B7] hover:text-[#071437] transition-colors">Mark all as read</button>
        <button onClick={onClose} className="text-[12px] text-[#1B84FF] hover:text-[#056EE9] transition-colors">Close</button>
      </div>
    </div>
  );
}

/* ── Topbar ────────────────────────────────────────────────────── */

export function Topbar() {
  const { user, signOut } = useAuth();
  const { toggleMobile } = useSidebar();
  const [userMenu, setUserMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Ctrl+K / Cmd+K shortcut
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const initials = user
    ? user.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'JM';

  return (
    <>
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-8 bg-white border-b border-[#E1E3EA]" style={{ height: 64 }}>
        {/* Left */}
        <div className="flex items-center gap-2">
          <button onClick={toggleMobile} className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-[#4B5675] hover:bg-[#F6F6F9] transition-colors mr-1">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5">
          {/* Search */}
          <button onClick={() => setShowSearch(true)} className="w-9 h-9 rounded-lg flex items-center justify-center text-[#99A1B7] hover:text-[#071437] hover:bg-[#F6F6F9] transition-colors" title="Search (Ctrl+K)">
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifs(v => !v); if (!showNotifs) setUnreadCount(0); }}
              className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[#99A1B7] hover:text-[#071437] hover:bg-[#F6F6F9] transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-[#F8285A] text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifs && <NotificationDropdown onClose={() => setShowNotifs(false)} />}
          </div>

          <div className="w-px h-6 bg-[#E1E3EA] mx-1" />

          {/* User */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setUserMenu(v => !v)} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[#F6F6F9] transition-colors">
              <div className="w-8 h-8 rounded-full bg-[#EEF6FF] border border-[#1B84FF]/20 flex items-center justify-center">
                <span className="text-[#1B84FF] text-[11px] font-semibold">{initials}</span>
              </div>
              {user && (
                <div className="hidden sm:block text-left">
                  <div className="text-[13px] font-medium text-[#071437] leading-tight">{user.name}</div>
                  <div className="text-[11px] text-[#99A1B7] leading-tight">{ROLE_LABELS[user.role] ?? user.role}</div>
                </div>
              )}
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#99A1B7]" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
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
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
