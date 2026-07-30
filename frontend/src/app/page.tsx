import Link from 'next/link';
import { Shield, FileCheck, QrCode, Landmark, Search, ScanLine, ArrowRight, CheckCircle2 } from 'lucide-react';

const features = [
  { icon: FileCheck, title: 'Document Verification', desc: 'Every title deed, survey map and land search is fingerprinted (SHA-256) and screened before a listing goes live.' },
  { icon: Shield, title: 'AI Fraud Detection', desc: 'Duplicate parcels, forged documents, blacklisted sellers and duplicate ownership are scored and blocked automatically.' },
  { icon: Landmark, title: 'Government Approval', desc: 'A multi-stage pipeline routes each parcel through admin, Ministry of Lands and licensed surveyor sign-off.' },
  { icon: QrCode, title: 'QR Title Certificates', desc: 'Buyers receive a tamper-proof, digitally-signed certificate that anyone can verify by scanning a QR code.' },
];

const steps = [
  'Seller registers & uploads title documents',
  'Admin, government & surveyor verification',
  'Listing published to the marketplace',
  'Buyer offer → seller & government approval',
  'Secure payment (M-Pesa / Card / Bank)',
  'Ownership transfer + QR digital certificate',
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-ink-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-semibold text-ink-900">
            <Shield className="h-6 w-6 text-brand-600" />
            LandGuard <span className="text-brand-600">Kenya</span>
          </div>
          <nav className="flex items-center gap-2 text-sm sm:gap-3">
            <Link href="/marketplace" className="hidden text-ink-600 hover:text-ink-900 sm:inline">Marketplace</Link>
            <Link href="/verify/demo-cert-qr-0001" className="hidden text-ink-600 hover:text-ink-900 md:inline">Verify a title</Link>
            <Link href="/login" className="btn-secondary">Sign in</Link>
            <Link href="/register" className="btn-primary hidden sm:inline-flex">Get started</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50 to-white" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center">
          <span className="badge bg-brand-100 text-brand-700">Reducing land fraud in Kenya</span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold tracking-tight text-ink-900 sm:text-5xl">
            Buy and sell land with <span className="text-brand-600">verified</span> ownership and zero fraud.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-600">
            LandGuard verifies every title deed, enforces government approval, detects fraud with AI risk scoring,
            and issues QR-verifiable digital certificates — so a handshake becomes a guarantee.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link href="/register" className="btn-primary px-6 py-3 text-base">
              Create free account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/marketplace" className="btn-secondary px-6 py-3 text-base">
              <Search className="h-4 w-4" /> Browse verified land
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-500">
            {['JWT + 2FA security', 'RBAC for 5 roles', 'Immutable audit trail', 'M-Pesa & card payments'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-brand-500" /> {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card p-6">
              <div className="mb-4 inline-flex rounded-lg bg-brand-50 p-3 text-brand-600">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-ink-900">{f.title}</h3>
              <p className="mt-2 text-sm text-ink-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-ink-900 py-16 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">A verified journey, end to end</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-ink-300">
            Ownership only transfers after every checkpoint is cleared.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s} className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-800 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold">{i + 1}</span>
                <p className="text-sm text-ink-100">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verify CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="card flex flex-col items-center gap-4 bg-brand-50 p-10 text-center">
          <ScanLine className="h-10 w-10 text-brand-600" />
          <h2 className="text-2xl font-bold text-ink-900">Verify any land title in seconds</h2>
          <p className="max-w-xl text-ink-600">
            Scan the QR code on a LandGuard certificate — or enter its code — to confirm the parcel, current owner and
            authenticity, with no account required.
          </p>
          <Link href="/verify/demo-cert-qr-0001" className="btn-primary px-6 py-3">Try a live verification</Link>
        </div>
      </section>

      <footer className="border-t border-ink-100 py-8 text-center text-sm text-ink-400">
        © 2026 LandGuard Kenya · Secure Land Selling & Ownership Verification Management System
      </footer>
    </div>
  );
}
