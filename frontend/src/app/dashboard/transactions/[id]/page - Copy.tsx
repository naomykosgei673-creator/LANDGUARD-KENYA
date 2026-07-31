'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, Wallet, Award, Loader2, Landmark, Clock } from 'lucide-react';
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

  const load = useCallback(async () => { setTx(await apiGet<Transaction>(`/transactions/${id}`)); setLoading(false); }, [id]);
  useAutoRefresh(load);

  async function act(fn: () => Promise<any>, key: string) {
    setBusy(key); setErr('');
    try { await fn(); await load(); } catch (e) { setErr(apiError(e)); } finally { setBusy(''); }
  }

  if (loading) return <PageLoader />;
  if (!tx) return <p className="text-ink-500">Transaction not found.</p>;

  const isSeller = user?.id === tx.seller?.id;
  const isBuyer = user?.id === tx.buyer?.id;
  const isOfficer = user?.role === 'GOVERNMENT_OFFICER' || user?.role === 'ADMIN';
  const stepIdx = FLOW.indexOf(tx.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/dashboard/transactions" className="inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> All transactions</Link>

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
              <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${i <= stepIdx && stepIdx >= 0 ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-400'}`}>{i + 1}</div>
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
              // Card settles instantly; M-Pesa/bank need sandbox confirmation.
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

      {tx.status === 'COMPLETED' && tx.certificate && (
        <div className="card border-brand-200 bg-brand-50 p-6">
          <div className="flex items-center gap-3">
            <Award className="h-10 w-10 text-brand-600" />
            <div>
              <h2 className="font-semibold text-ink-900">Digital title certificate issued</h2>
              <p className="text-sm text-ink-600">Certificate {tx.certificate.certificateNumber} · issued {formatDate(tx.certificate.issuedAt)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-brand-800">Ownership has been transferred to the buyer and recorded in the registry. The certificate is QR-verifiable by anyone.</p>
        </div>
      )}

      {isBuyer && ['OFFER_MADE', 'GOV_APPROVAL_PENDING'].includes(tx.status) && (
        <div className="card flex items-center gap-3 p-4 text-sm text-ink-500"><Clock className="h-5 w-5 text-amber-500" /> Waiting on {tx.status === 'OFFER_MADE' ? 'the seller to accept your offer' : 'government approval'}.</div>
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
    </div>
  );
}
