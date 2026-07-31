'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Shield, Search, QrCode, Camera, ShieldCheck, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export default function VerifyToolPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  function handleVerify(targetCode: string) {
    const c = targetCode.trim();
    if (c) {
      router.push(`/verify/${encodeURIComponent(c)}`);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleVerify(code);
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      {/* Header */}
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
            <Shield className="h-5 w-5 text-brand-600" /> LandGuard Kenya
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs font-semibold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full border border-brand-200 sm:inline">
              Public Verification Portal
            </span>
            <Link href="/" className="btn-secondary px-3 py-1.5 text-xs" aria-label="Return to the home page">
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Tool Content */}
      <main className="animate-in mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="w-full text-center space-y-3 mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
            <ShieldCheck className="h-4 w-4" /> Cryptographic Ownership Verification
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
            Verify Land Title & Certificate
          </h1>
          <p className="text-sm text-ink-600 max-w-lg mx-auto">
            Enter a LandGuard QR code token or official digital certificate number below to check registry authenticity and ownership status in real-time.
          </p>
        </div>

        {/* Verification Card */}
        <div className="card w-full p-6 sm:p-8 space-y-6 shadow-xl border-brand-100">
          {/* Tabs / Mode Toggle */}
          <div className="flex items-center justify-center gap-2 border-b border-ink-100 pb-4">
            <button
              onClick={() => setIsScanning(false)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                !isScanning ? 'bg-brand-600 text-white shadow-sm' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              <Search className="h-4 w-4" /> Enter Code / Reference
            </button>
            <button
              onClick={() => setIsScanning(true)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                isScanning ? 'bg-brand-600 text-white shadow-sm' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              }`}
            >
              <Camera className="h-4 w-4" /> Camera QR Scanner
            </button>
          </div>

          {!isScanning ? (
            /* Search Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="code-input" className="label text-left mb-1 text-ink-700 font-medium">
                  Certificate Code / QR Token
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 h-5 w-5 text-ink-400" />
                  <input
                    id="code-input"
                    type="text"
                    className="input pl-11 py-3 text-base font-mono"
                    placeholder="e.g. demo-cert-qr-0001 or LG-CERT-..."
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus
                  />
                </div>
                <p className="mt-1.5 text-left text-xs text-ink-400">
                  Located on the printed title certificate or scanned QR payload.
                </p>
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
                disabled={!code.trim()}
              >
                Verify Code Now <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          ) : (
            /* Camera Simulator / Scanner Tool */
            <div className="text-center py-6 space-y-4 bg-ink-900 text-white rounded-xl relative overflow-hidden">
              <div className="relative mx-auto h-44 w-44 rounded-2xl border-2 border-dashed border-brand-400 flex flex-col items-center justify-center p-4 bg-ink-950/60">
                <QrCode className="h-16 w-16 text-brand-400 animate-pulse" />
                <div className="absolute inset-x-0 top-0 h-1 bg-brand-500 shadow-lg shadow-brand-500/50 animate-bounce" />
                <span className="mt-2 text-xs font-mono text-brand-300">Align QR code within frame</span>
              </div>

              <div className="space-y-2 px-4">
                <p className="text-xs text-ink-300">Position the physical certificate QR code in front of your camera.</p>
                <button
                  type="button"
                  onClick={() => handleVerify('demo-cert-qr-0001')}
                  className="btn-primary py-2 text-xs inline-flex items-center gap-1.5 bg-brand-500 hover:bg-brand-400"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Simulate Scan of Demo Certificate
                </button>
              </div>
            </div>
          )}

          {/* Quick Demo Pre-fill Option */}
          <div className="border-t border-ink-100 pt-4 text-left">
            <span className="text-xs font-semibold text-ink-500 block mb-2">Instant Demo Testing:</span>
            <button
              type="button"
              onClick={() => handleVerify('demo-cert-qr-0001')}
              className="w-full flex items-center justify-between p-3 rounded-lg bg-brand-50 border border-brand-200 text-left hover:bg-brand-100 transition group"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-brand-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-ink-900 block">Ruai Plot Title Certificate (Demo)</span>
                  <span className="font-mono text-[11px] text-brand-700">demo-cert-qr-0001</span>
                </div>
              </div>
              <span className="text-xs font-semibold text-brand-700 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                Test <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
        </div>

        {/* Security Notes */}
        <div className="mt-8 text-center text-xs text-ink-400 max-w-md">
          🔒 LandGuard Kenya verification uses SHA-256 HMAC digital signatures. Any altered record or fake title certificate will fail verification automatically.
        </div>
      </main>
    </div>
  );
}
