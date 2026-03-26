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
      <div className="flex items-center justify-center gap-2 mb-8">
        <div className="w-10 h-10 bg-[#1B84FF] rounded-xl flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-bold tracking-tight">PF</span>
        </div>
        <span className="font-semibold text-[#071437] text-xl">PlanFlow</span>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl border border-[#E1E3EA] shadow-sm p-8">
        <h1 className="text-[22px] font-semibold text-[#071437] mb-1">
          Sign in to your account
        </h1>
        <p className="text-sm text-[#99A1B7] mb-6">
          Jasmin Media &mdash; Media Planning Tool
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-[#4B5675]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@jasminmedia.com"
              className="w-full h-10 px-3 rounded-lg border border-[#E1E3EA] text-sm text-[#071437] placeholder-[#C9CDDA] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-[#4B5675]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3 rounded-lg border border-[#E1E3EA] text-sm text-[#071437] placeholder-[#C9CDDA] focus:outline-none focus:border-[#1B84FF] focus:ring-1 focus:ring-[#1B84FF]/20 transition"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-[#FFF5F5] border border-[#FFD2D2] px-3 py-2.5 text-sm text-[#F8285A]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-10 rounded-lg bg-[#1B84FF] text-white text-sm font-semibold hover:bg-[#056EE9] disabled:opacity-60 disabled:cursor-not-allowed transition mt-1"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
