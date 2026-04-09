'use client';

import { usePathname } from 'next/navigation';
import { useSidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const noSidebar = pathname === '/login' || pathname.startsWith('/shared/');

  if (noSidebar) return <>{children}</>;

  const ml = collapsed ? 80 : 264;

  return (
    <div className="min-h-screen flex flex-col lg:transition-sidebar" style={{ marginLeft: 0 }}>
      <style>{`@media (min-width: 1024px) { .sidebar-content { margin-left: ${ml}px; } }`}</style>
      <div className="sidebar-content flex flex-col min-h-screen">
        <Topbar />
        {children}
      </div>
    </div>
  );
}
