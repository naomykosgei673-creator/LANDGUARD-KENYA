'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, ShieldCheck, ShieldX, MapPin, Ruler, User, Hash, Loader2, Search } from 'lucide-react';
import { apiGet } from '@/lib/api';

interface VerifyResult {
  valid: boolean;
  reason?: string | null;
  type?: string;
  scans?: number;
  parcel?: any;
  certificate?: { certificateNumber: string; issuedAt: string } | null;
}

export default function VerifyPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [entry, setEntry] = useState('');

  useEffect(() => {
    setLoading(true);
    apiGet<VerifyResult>(`/qr/verify/${code}`)
      .then(setResult)
      .catch((err: any) => {
        // Distinguish "record isn't in the registry" from "couldn't reach the server".
        const unreachable = !err?.response;
        setResult({
          valid: false,
          reason: unreachable
            ? 'Could not reach the verification server. Please check your connection and try again.'
            : 'This code is not in the LandGuard registry.',
        });
      })
      .finally(() => setLoading(false));
  }, [code]);

  function verifyEntered(e: React.FormEvent) {
    e.preventDefault();
    const c = entry.trim();
    if (c) router.push(`/verify/${encodeURIComponent(c)}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900"><Shield className="h-5 w-5 text-brand-600" /> LandGuard</Link>
          <span className="text-sm text-ink-500">Title verification</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 items-start justify-center px-4 py-10">
        {loading ? (
          <div className="flex items-center gap-2 text-ink-400"><Loader2 className="h-5 w-5 animate-spin" /> Verifying…</div>
        ) : (
          <div className="w-full">
            <div className={`card overflow-hidden`}>
              <div className={`flex items-center gap-3 p-6 ${result?.valid ? 'bg-brand-600' : 'bg-red-600'} text-white`}>
                {result?.valid ? <ShieldCheck className="h-10 w-10" /> : <ShieldX className="h-10 w-10" />}
                <div>
                  <p className="text-lg font-bold">{result?.valid ? 'Authentic & verified' : 'Verification failed'}</p>
                  <p className="text-sm opacity-90">
                    {result?.valid ? `Genuine LandGuard ${(result.type ?? 'record').toLowerCase()} · scanned ${result.scans} time(s)` : (result?.reason ?? 'This code could not be verified.')}
                  </p>
                </div>
              </div>

              {result?.parcel && (
                <div className="space-y-4 p-6">
                  <Row icon={<Hash className="h-4 w-4" />} label="Parcel number" value={result.parcel.parcelNumber} />
                  <Row icon={<Hash className="h-4 w-4" />} label="Title deed" value={result.parcel.titleDeedNumber} />
                  <Row icon={<MapPin className="h-4 w-4" />} label="Location" value={`${result.parcel.locality}, ${result.parcel.county}`} />
                  <Row icon={<Ruler className="h-4 w-4" />} label="Size" value={`${result.parcel.sizeAcres} acres`} />
                  <Row icon={<User className="h-4 w-4" />} label="Current owner" value={result.parcel.currentOwner ?? '—'} />
                  {result.certificate && (
                    <Row icon={<ShieldCheck className="h-4 w-4" />} label="Certificate" value={result.certificate.certificateNumber} />
                  )}
                </div>
              )}
            </div>
            <p className="mt-4 text-center text-xs text-ink-400">
              This verification confirms the record exists in the LandGuard registry and its digital signature is intact.
            </p>

            {/* Verify another code — matches the "or enter its code" promise on the landing page. */}
            <form onSubmit={verifyEntered} className="card mt-6 flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="verify-code">Certificate or QR code</label>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
                <input
                  id="verify-code"
                  className="input pl-9"
                  placeholder="Enter a certificate / QR code to verify…"
                  value={entry}
                  onChange={(e) => setEntry(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={!entry.trim()}>Verify code</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <span className="inline-flex items-center gap-2 text-sm text-ink-500">{icon} {label}</span>
      <span className="font-medium text-ink-900">{value}</span>
    </div>
  );
}
