import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign In — PlanFlow',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#F9F9F9] flex items-center justify-center p-4">
      <LoginForm />
    </main>
  );
}
