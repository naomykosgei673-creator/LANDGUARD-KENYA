'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Loader2, UserRound, Store } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { apiError } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'BUYER' as 'BUYER' | 'SELLER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      router.push('/dashboard');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 font-semibold text-ink-900">
          <Shield className="h-6 w-6 text-brand-600" /> LandGuard Kenya
        </Link>
        <div className="card p-6">
          <h1 className="text-xl font-bold text-ink-900">Create your account</h1>
          <p className="mt-1 text-sm text-ink-500">Join the secure land marketplace.</p>

          {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setForm({ ...form, role: 'BUYER' })}
                className={cn('flex flex-col items-center gap-1 rounded-lg border p-3 text-sm', form.role === 'BUYER' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600')}>
                <UserRound className="h-5 w-5" /> I want to buy
              </button>
              <button type="button" onClick={() => setForm({ ...form, role: 'SELLER' })}
                className={cn('flex flex-col items-center gap-1 rounded-lg border p-3 text-sm', form.role === 'SELLER' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600')}>
                <Store className="h-5 w-5" /> I want to sell
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">First name</label><input className="input" value={form.firstName} onChange={set('firstName')} required /></div>
              <div><label className="label">Last name</label><input className="input" value={form.lastName} onChange={set('lastName')} required /></div>
            </div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={set('email')} required /></div>
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={set('phone')} placeholder="2547XXXXXXXX" required /></div>
            <div><label className="label">Password</label><input className="input" type="password" value={form.password} onChange={set('password')} required placeholder="Min 8 chars, 1 uppercase, 1 number" /></div>
            <button className="btn-primary w-full py-2.5" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create account
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-ink-500">
            Already registered? <Link href="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
