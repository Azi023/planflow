'use client';

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 2500);
    return () => clearTimeout(t);
  }, [onClose]);

  const colors =
    type === 'success'
      ? 'bg-[#DFFFEA] text-[#17C653] border-[#17C653]/20'
      : 'bg-[#FFF5F8] text-[#F8285A] border-[#F8285A]/20';

  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-2.5 rounded-lg border text-sm font-medium shadow-lg z-50 ${colors}`}
    >
      {message}
    </div>
  );
}
