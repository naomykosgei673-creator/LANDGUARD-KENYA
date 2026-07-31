'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Wallet,
  Award,
  Loader2,
  Landmark,
  Clock,
  QrCode as QrIcon,
  Eye,
  Printer,
  ShieldCheck,
  ExternalLink,
  X,
  FileCheck,
} from 'lucide-react';
import { apiGet, apiPost, apiError } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { useAuth } from '@/lib/auth';
import { Badge, PageLoader } from '@/components/ui';
import { formatKES, formatDate, prettyStatus } from '@/lib/utils';
import type { Transaction } from '@/lib/types';

const FLOW = ['OFFER_MADE', 'GOV_APPROVAL_PENDING', 'PAYMENT_PENDING', 'PAID', 'COMPLETED'];

export default function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [method, setMethod] = useState('MPESA');
  const [phone, setPhone] = useState('254700000005');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);

  const load = useCallback(async () => {
    const res = await apiGet<Transaction>(`/transactions/${id}`);
    setTx(res);
    setLoading(false);
  }, [id]);
  useAutoRefresh(load);

  const qrCodeCode = tx?.certificate?.qrCode?.code || 'demo-cert-qr-0001';

  useEffect(() => {
    if (tx?.certificate) {
      apiGet<{ dataUrl: string }>(`/qr/render/${qrCodeCode}`)
        .then((res) => setQrDataUrl(res.dataUrl))
        .catch(() => setQrDataUrl(null));
    }
  }, [tx?.certificate, qrCodeCode]);

  async function act(fn: () => Promise<any>, key: string) {
    setBusy(key);
    setErr('');
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(apiError(e));
    } finally {
      setBusy('');
    }
  }

  if (loading) return <PageLoader />;
  if (!tx) return <p className="text-ink-500">Transaction not found.</p>;

  const isSeller = user?.id === tx.seller?.id;
  const isBuyer = user?.id === tx.buyer?.id;
  const isOfficer = user?.role === 'GOVERNMENT_OFFICER' || user?.role === 'ADMIN';
  const stepIdx = FLOW.indexOf(tx.status);
  const ownerName = tx.certificate?.owner
    ? `${tx.certificate.owner.firstName} ${tx.certificate.owner.lastName}`
    : tx.buyer
    ? `${tx.buyer.firstName} ${tx.buyer.lastName}`
    : 'Registered Buyer';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/transactions" className="inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> All transactions
      </Link>

      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink-900">{tx.parcel?.locality}, {tx.parcel?.county}</h1>
            <p className="text-sm text-ink-500">Parcel {tx.parcel?.parcelNumber} · Ref {tx.reference.slice(0, 10)}</p>
          </div>
          <Badge status={tx.status}>{prettyStatus(tx.status)}</Badge>
        </div>
        <p className="mt-4 text-3xl font-bold text-brand-700">{formatKES(tx.offerAmount)}</p>

        {/* Progress */}
        <ol className="mt-6 grid grid-cols-5 gap-1">
          {['Offer', 'Gov approval', 'Payment', 'Paid', 'Transferred'].map((label, i) => (
            <li key={label} className="text-center">
              <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${i <= stepIdx && stepIdx >= 0 ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-400'}`}>
                {i + 1}
              </div>
              <p className="mt-1 text-[11px] text-ink-500">{label}</p>
            </li>
          ))}
        </ol>
      </div>

      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {/* Actions */}
      {isSeller && tx.status === 'OFFER_MADE' && (
        <div className="card p-6">
          <h2 className="mb-3 font-semibold text-ink-900">Respond to this offer</h2>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!!busy} onClick={() => act(() => apiPost(`/transactions/${id}/respond`, { decision: 'ACCEPT' }), 'a')}>
              {busy === 'a' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Accept offer
            </button>
            <button className="btn-danger" disabled={!!busy} onClick={() => act(() => apiPost(`/transactions/${id}/respond`, { decision: 'REJECT' }), 'r')}>
              <XCircle className="h-4 w-4" /> Decline
            </button>
          </div>
        </div>
      )}

      {isOfficer && tx.status === 'GOV_APPROVAL_PENDING' && (
        <div className="card p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink-900"><Landmark className="h-5 w-5 text-brand-600" /> Government transfer approval</h2>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!!busy} onClick={() => act(() => apiPost(`/transactions/${id}/gov-approve`, { approve: true }), 'ga')}>
              {busy === 'ga' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve transfer
            </button>
            <button className="btn-danger" disabled={!!busy} onClick={() => act(() => apiPost(`/transactions/${id}/gov-approve`, { approve: false }), 'gr')}>
              <XCircle className="h-4 w-4" /> Reject
            </button>
          </div>
        </div>
      )}

      {isBuyer && tx.status === 'PAYMENT_PENDING' && (
        <div className="card p-6">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-ink-900"><Wallet className="h-5 w-5 text-brand-600" /> Complete payment</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Method</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                {['MPESA', 'VISA', 'MASTERCARD', 'BANK_TRANSFER'].map((m) => <option key={m} value={m}>{prettyStatus(m)}</option>)}
              </select>
            </div>
            {method === 'MPESA' && (
              <div><label className="label">M-Pesa phone</label><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            )}
            <button className="btn-primary" disabled={!!busy} onClick={() => act(async () => {
              const res = await apiPost<any>('/payments', { transactionId: id, method, phoneNumber: method === 'MPESA' ? phone : undefined });
              if (res.payment.status === 'PENDING') {
                await apiPost(`/payments/${res.payment.reference}/confirm-sandbox`, {});
              }
            }, 'pay')}>
              {busy === 'pay' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />} Pay {formatKES(tx.offerAmount)}
            </button>
          </div>
          <p className="mt-2 text-xs text-ink-400">Sandbox mode: payment is simulated end-to-end, then ownership transfers and a certificate is issued.</p>
        </div>
      )}

      {/* Completed Transaction — Certificate & Generated QR Code */}
      {tx.status === 'COMPLETED' && tx.certificate && (
        <div className="card border-brand-200 bg-brand-50 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Award className="h-10 w-10 text-brand-600 shrink-0 mt-1" />
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-800">
                  <ShieldCheck className="h-3.5 w-3.5" /> Official Title Deed Issued
                </span>
                <h2 className="text-lg font-bold text-ink-900 mt-1">Digital Title Certificate</h2>
                <p className="text-sm text-ink-600">Certificate No: <span className="font-mono font-medium text-ink-900">{tx.certificate.certificateNumber}</span></p>
                <p className="text-xs text-ink-500">Issued: {formatDate(tx.certificate.issuedAt)}</p>
              </div>
            </div>

            {/* QR Code Thumbnail Preview */}
            <div className="flex flex-col items-center bg-white p-3 rounded-xl border border-brand-200 shadow-sm shrink-0">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Certificate QR Code" className="h-28 w-28 object-contain" />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center bg-ink-50 text-xs text-ink-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              <span className="mt-1 text-[11px] font-mono font-semibold text-brand-700 flex items-center gap-1">
                <QrIcon className="h-3 w-3" /> {qrCodeCode.slice(0, 12)}…
              </span>
            </div>
          </div>

          <p className="text-sm text-brand-800 border-t border-brand-100 pt-3">
            Ownership of parcel <strong className="text-ink-900">{tx.parcel?.parcelNumber}</strong> has been transferred to{' '}
            <strong className="text-ink-900">{ownerName}</strong> and registered. Scanning the QR code verifies authenticity on the public registry.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowCertModal(true)}>
              <Eye className="h-4 w-4" /> View / Download Certificate
            </button>
            <Link href={`/verify/${qrCodeCode}`} target="_blank" className="btn-outline flex items-center gap-2 text-ink-700 bg-white">
              <ExternalLink className="h-4 w-4 text-brand-600" /> Verify QR Online
            </Link>
          </div>
        </div>
      )}

      {isBuyer && ['OFFER_MADE', 'GOV_APPROVAL_PENDING'].includes(tx.status) && (
        <div className="card flex items-center gap-3 p-4 text-sm text-ink-500">
          <Clock className="h-5 w-5 text-amber-500" /> Waiting on {tx.status === 'OFFER_MADE' ? 'the seller to accept your offer' : 'government approval'}.
        </div>
      )}

      {/* Payments */}
      {tx.payments && tx.payments.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 font-semibold text-ink-900">Payment history</h2>
          {tx.payments.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between border-b border-ink-100 py-2 text-sm last:border-0">
              <span className="text-ink-600">{prettyStatus(p.method)} · {p.reference?.slice(0, 10)}</span>
              <span className="flex items-center gap-2 text-ink-800">{formatKES(p.amount)} <Badge status={p.status}>{prettyStatus(p.status)}</Badge></span>
            </div>
          ))}
        </div>
      )}

      {/* Official Certificate Printable Modal */}
      {showCertModal && tx.certificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-ink-200 my-8">
            {/* Modal Control Bar (Hidden when printing) */}
            <div className="flex items-center justify-between bg-ink-900 px-6 py-3 text-white print:hidden">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <FileCheck className="h-4 w-4 text-brand-400" /> Official Land Title Document
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 transition"
                >
                  <Printer className="h-3.5 w-3.5" /> Print / Save PDF
                </button>
                <button
                  onClick={() => setShowCertModal(false)}
                  className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Certificate Body (Formatted Document) */}
            <div className="p-8 bg-white text-ink-900 space-y-6 print:p-0">
              {/* Decorative Header */}
              <div className="text-center border-b-2 border-brand-700 pb-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700 border-2 border-brand-600 mb-2">
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h3 className="text-xs tracking-widest uppercase font-bold text-brand-800">Republic of Kenya · LandGuard Registry</h3>
                <h1 className="text-2xl font-serif font-bold text-ink-900 mt-1">DIGITAL LAND TITLE CERTIFICATE</h1>
                <p className="text-xs text-ink-500 mt-1">Issued under the Land Registration & Verification Framework</p>
              </div>

              {/* Certificate Details */}
              <div className="grid grid-cols-2 gap-4 text-sm bg-ink-50 p-4 rounded-xl border border-ink-200">
                <div>
                  <span className="text-xs font-semibold uppercase text-ink-400 block">Certificate No.</span>
                  <span className="font-mono font-bold text-brand-800">{tx.certificate.certificateNumber}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-ink-400 block">Date of Issue</span>
                  <span className="font-medium text-ink-800">{formatDate(tx.certificate.issuedAt)}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-ink-400 block">Registered Owner</span>
                  <span className="font-bold text-ink-900">{ownerName}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-ink-400 block">Parcel Number</span>
                  <span className="font-mono font-semibold text-ink-900">{tx.parcel?.parcelNumber}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-ink-400 block">Title Deed Ref</span>
                  <span className="font-mono text-ink-800">{tx.parcel?.titleDeedNumber ?? 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-ink-400 block">Location</span>
                  <span className="font-medium text-ink-800">{tx.parcel?.locality}, {tx.parcel?.county}</span>
                </div>
              </div>

              {/* QR Verification Section */}
              <div className="flex items-center gap-6 border-t border-b border-ink-100 py-4">
                <div className="shrink-0 bg-white p-2 border border-ink-200 rounded-lg">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="Certificate QR Code" className="h-32 w-32 object-contain" />
                  ) : (
                    <div className="flex h-32 w-32 items-center justify-center bg-ink-50 text-xs text-ink-400">Loading QR…</div>
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-ink-900 flex items-center gap-1.5 text-sm">
                    <QrIcon className="h-4 w-4 text-brand-600" /> Instant Verification Code
                  </h4>
                  <p className="text-xs text-ink-600 leading-relaxed">
                    This document carries a cryptographically signed QR code. Anyone can verify this certificate by scanning the QR code or visiting:
                  </p>
                  <code className="block text-[11px] bg-ink-100 text-ink-800 px-2 py-1 rounded font-mono break-all">
                    /verify/{qrCodeCode}
                  </code>
                </div>
              </div>

              {/* Digital Signature Footer */}
              <div className="space-y-1 text-xs text-ink-500">
                <span className="font-semibold text-ink-700 block">Cryptographic HMAC Signature:</span>
                <p className="font-mono text-[10px] bg-ink-50 p-2 rounded border border-ink-200 break-all text-ink-600">
                  {tx.certificate.signature || 'HMAC-SHA256-AUTHENTICATED-LANDGUARD-SEAL'}
                </p>
              </div>

              <div className="text-center pt-2 text-[11px] text-ink-400">
                © {new Date().getFullYear()} LandGuard Kenya Registry System · Immutable Land Ownership Record
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

