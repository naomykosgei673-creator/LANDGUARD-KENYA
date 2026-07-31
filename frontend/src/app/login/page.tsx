'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { apiError } from '@/lib/api';

const demos = [
  { role: 'Admin', email: 'admin@landguard.co.ke' },
  { role: 'Gov Officer', email: 'officer@landguard.co.ke' },
  { role: 'Surveyor', email: 'surveyor@landguard.co.ke' },
  { role: 'Seller', email: 'seller@landguard.co.ke' },
  { role: 'Buyer', email: 'buyer@landguard.co.ke' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [need2fa, setNeed2fa] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password, need2fa ? twoFactorToken : undefined);
      if (res.twoFactorRequired) {
        setNeed2fa(true);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(apiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-ink-900 p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Shield className="h-6 w-6 text-brand-500" /> LandGuard Kenya
        </Link>
        <div>
          <h2 className="text-3xl font-bold leading-tight">Secure land ownership starts with verified identity.</h2>
          <p className="mt-4 text-ink-300">Sign in to manage listings, review verifications, approve transfers, and track ownership — all under an immutable audit trail.</p>
        </div>
        <p className="text-sm text-ink-400">© 2026 LandGuard Kenya</p>
      </div>

      {/* Form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm animate-in">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
              <Shield className="h-6 w-6 text-brand-600" /> LandGuard Kenya
            </Link>
            <Link href="/" className="btn-secondary px-3 py-1.5 text-xs" aria-label="Return to the home page">
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
          </div>
          <Link href="/" className="mb-5 hidden w-fit items-center gap-1.5 text-sm font-medium text-ink-500 transition-colors hover:text-brand-700 lg:inline-flex">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <h1 className="text-2xl font-bold text-ink-900">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to your account.</p>

          {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <form onSubmit={submit} autoComplete="off" className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" name="login-email" type="email" autoComplete="off" data-lpignore="true" data-1p-ignore="true" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            {need2fa && (
              <div>
                <label className="label">2FA code</label>
                <input className="input tracking-widest" inputMode="numeric" maxLength={6} value={twoFactorToken} onChange={(e) => setTwoFactorToken(e.target.value)} placeholder="123456" />
              </div>
            )}
            <button className="btn-primary w-full py-2.5" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-ink-500">
            No account? <Link href="/register" className="font-medium text-brand-600 hover:underline">Create one</Link>
          </p>

          <div className="mt-8 rounded-lg border border-dashed border-ink-200 p-3">
            <p className="mb-2 text-xs font-medium text-ink-500">Demo accounts · password <code className="rounded bg-ink-100 px-1">Password123!</code></p>
            <div className="grid grid-cols-1 gap-1 text-sm">
              {demos.map((d) => (
                <button key={d.email} type="button" onClick={() => { setEmail(d.email); setPassword('Password123!'); }}
                  className="flex items-center justify-between rounded px-2 py-1 text-left hover:bg-ink-50">
                  <span className="font-medium text-ink-700">{d.role}</span>
                  <span className="text-xs text-ink-400">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
