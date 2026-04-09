'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import type { AuthUser } from '@/lib/auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export function LoginForm() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? 'Invalid email or password');
        return;
      }
      const data = await res.json() as { access_token: string; user: AuthUser };
      signIn(data.access_token, data.user);
      router.replace('/');
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px]">
      {/* Logo */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <div className="w-11 h-11 bg-[#1B84FF] rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-bold tracking-tight">PF</span>
        </div>
        <div>
          <span className="font-semibold text-[#071437] text-xl">Plan</span>
          <span className="font-semibold text-[#1B84FF] text-xl">Flow</span>
        </div>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-[#E1E3EA] p-8" style={{ boxShadow: '0px 3px 4px 0px rgba(0, 0, 0, 0.03)' }}>
        <h1 className="text-[22px] font-semibold text-[#071437] mb-1">Welcome back</h1>
        <p className="text-[13px] text-[#99A1B7] mb-7">Sign in to your account</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-[13px] font-medium text-[#4B5675]">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#B5B5C3]">
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7" />
                </svg>
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@jasminmedia.com"
                className="w-full h-11 pl-11 pr-3.5 rounded-lg border border-[#DBDFE9] text-[13px] text-[#071437] placeholder-[#B5B5C3] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-[13px] font-medium text-[#4B5675]">Password</label>
              <span className="text-[12px] text-[#1B84FF] cursor-default">Forgot password?</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#B5B5C3]">
                <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-11 pl-11 pr-11 rounded-lg border border-[#DBDFE9] text-[13px] text-[#071437] placeholder-[#B5B5C3] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition"
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#B5B5C3] hover:text-[#4B5675] transition-colors"
                tabIndex={-1}
              >
                {showPw ? (
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded border-[#DBDFE9] text-[#1B84FF] focus:ring-[#1B84FF]/20" />
            <span className="text-[13px] text-[#4B5675]">Remember me</span>
          </label>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-[#FFEEF3] border border-[#F8285A]/20 px-4 py-3 text-[13px] text-[#F8285A] flex items-center gap-2">
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-[#1B84FF] text-white text-[13px] font-semibold hover:bg-[#056EE9] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all mt-1"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeLinecap="round" className="opacity-25" />
                  <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-[12px] text-[#99A1B7] mt-6">
        Powered by <span className="font-medium text-[#4B5675]">Jasmin Media</span>
      </p>
    </div>
  );
}
