'use client';

import { usePathname } from 'next/navigation';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname();
  const noSidebar = pathname === '/login' || pathname.startsWith('/shared/');

  if (noSidebar) return <>{children}</>;

  return (
    <div style={{ marginLeft: 260 }} className="min-h-screen flex flex-col">
      {children}
    </div>
  );
}
