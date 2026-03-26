'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  if (pathname === '/login') return <>{children}</>;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F9F9F9]">
        <div
          className="w-8 h-8 rounded-full border-2 border-[#1B84FF] border-t-transparent animate-spin"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
