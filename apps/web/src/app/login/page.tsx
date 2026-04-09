import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign In — PlanFlow',
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(180deg, #F6F6F9 0%, #FFFFFF 100%)' }}>
      <LoginForm />
    </main>
  );
}
