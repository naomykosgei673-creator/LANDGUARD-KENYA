'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, MapPin, Ruler, FileText, ShieldCheck, CheckCircle2, XCircle, Clock, ArrowLeft, QrCode, AlertTriangle, ExternalLink } from 'lucide-react';
import { apiGet, apiPost, apiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, PageLoader } from '@/components/ui';
import { formatKES, formatDate, prettyStatus, riskBand } from '@/lib/utils';
import type { Parcel } from '@/lib/types';

export default function ParcelDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(true);
  const [offer, setOffer] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<Parcel>(`/parcels/${id}`).then((p) => { setParcel(p); setOffer(String(p.price)); }).finally(() => setLoading(false));
  }, [id]);

  async function makeOffer() {
    setBusy(true); setMsg('');
    try {
      const tx = await apiPost<any>('/transactions', { parcelId: id, offerAmount: Number(offer) });
      router.push(`/dashboard/transactions/${tx.id}`);
    } catch (e) { setMsg(apiError(e)); } finally { setBusy(false); }
  }

  async function viewDoc(doc: any) {
    try {
      const res = await apiGet<any>(`/documents/${doc.id}/content`);
      if (res.contentBase64) {
        const dataUrl = `data:${res.mimeType};base64,${res.contentBase64}`;

        if (res.mimeType === 'application/pdf') {
          const byteCharacters = atob(res.contentBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
        } else {
          const win = window.open();
          if (win) {
            win.document.write(`<title>${res.fileName || 'Document View'}</title>`);
            win.document.write(`<img src="${dataUrl}" style="max-width:100%; height:auto;" />`);
          }
        }
      } else {
        // Fallback for simulation: open a sample PDF
        window.open('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', '_blank');
      }
    } catch (e) { alert(apiError(e)); }
  }

  if (loading) return <div className="min-h-screen bg-ink-50 p-8"><PageLoader /></div>;
  if (!parcel) return <div className="min-h-screen bg-ink-50 p-8 text-center text-ink-500">Parcel not found.</div>;

  const canOffer = user?.role === 'BUYER' && ['LISTED', 'VERIFIED'].includes(parcel.status);
  const risk = riskBand(parcel.riskScore);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/marketplace" className="flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Back to marketplace</Link>
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900"><Shield className="h-5 w-5 text-brand-600" /> LandGuard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main */}
          <div className="space-y-6 lg:col-span-2">
            <div className="card overflow-hidden">
              <div className="h-64 w-full bg-ink-100">
                {parcel.featuredImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={parcel.featuredImage} alt={parcel.locality} className="h-full w-full object-cover" />
                ) : <div className="flex h-full items-center justify-center text-ink-300"><MapPin className="h-10 w-10" /></div>}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <Badge status={parcel.status}>{prettyStatus(parcel.status)}</Badge>
                  {['LISTED', 'VERIFIED'].includes(parcel.status) && <span className="badge bg-brand-100 text-brand-700"><ShieldCheck className="mr-1 h-3 w-3" /> Government Verified</span>}
                </div>
                <h1 className="mt-3 text-2xl font-bold text-ink-900">{parcel.locality}, {parcel.county}</h1>
                <p className="text-ink-500">{parcel.subCounty} · Parcel {parcel.parcelNumber}</p>
                <div className="mt-4 flex flex-wrap gap-6 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-ink-700"><Ruler className="h-4 w-4 text-brand-600" /> {parcel.sizeAcres} acres</span>
                  <span className="inline-flex items-center gap-1.5 text-ink-700"><MapPin className="h-4 w-4 text-brand-600" /> {prettyStatus(parcel.landUse)}</span>
                  <span className="inline-flex items-center gap-1.5 text-ink-700"><FileText className="h-4 w-4 text-brand-600" /> Title {parcel.titleDeedNumber}</span>
                </div>
                <p className="mt-4 text-ink-700">{parcel.description}</p>
              </div>
            </div>

            {/* Verification timeline */}
            {parcel.verifications && parcel.verifications.length > 0 && (
              <div className="card p-5">
                <h2 className="mb-4 font-semibold text-ink-900">Verification trail</h2>
                <ol className="space-y-3">
                  {parcel.verifications.map((v) => (
                    <li key={v.id} className="flex items-start gap-3">
                      {v.status === 'APPROVED' ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-brand-600" />
                        : v.status === 'REJECTED' ? <XCircle className="mt-0.5 h-5 w-5 text-red-600" />
                        : <Clock className="mt-0.5 h-5 w-5 text-amber-500" />}
                      <div>
                        <p className="font-medium text-ink-800">{prettyStatus(v.stage)}</p>
                        <p className="text-sm text-ink-500">{prettyStatus(v.status)}{v.decidedAt ? ` · ${formatDate(v.decidedAt)}` : ''}{v.notes ? ` — ${v.notes}` : ''}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Documents */}
            {parcel.documents && parcel.documents.length > 0 && (
              <div className="card p-5">
                <h2 className="mb-4 font-semibold text-ink-900">Documents</h2>
                <div className="space-y-2">
                  {parcel.documents.map((d) => {
                    const isOfficial = user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICER' || user?.role === 'SURVEYOR';
                    return (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
                        <span className="inline-flex items-center gap-2 text-sm text-ink-700"><FileText className="h-4 w-4 text-ink-400" /> {prettyStatus(d.type)}</span>
                        <div className="flex items-center gap-3">
                          {isOfficial && (
                            <button onClick={() => viewDoc(d)} className="text-xs font-medium text-brand-600 hover:text-brand-700 inline-flex items-center gap-1">
                              View <ExternalLink className="h-3 w-3" />
                            </button>
                          )}
                          <Badge status={d.status}>{prettyStatus(d.status)}</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fraud flags (privileged/owner only — backend controls visibility) */}
            {parcel.fraudFlags && parcel.fraudFlags.length > 0 && (
              <div className="card border-red-200 p-5">
                <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-700"><AlertTriangle className="h-5 w-5" /> Fraud flags</h2>
                <div className="space-y-2">
                  {parcel.fraudFlags.map((f) => (
                    <div key={f.id} className="flex items-start justify-between gap-3 rounded-lg bg-red-50 px-3 py-2">
                      <p className="text-sm text-red-800">{f.description}</p>
                      <Badge status={f.severity}>{f.severity}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="card p-5">
              <p className="text-sm text-ink-500">Asking price</p>
              <p className="text-3xl font-bold text-brand-700">{formatKES(parcel.price)}</p>
              <p className="mt-1 text-sm text-ink-500">{formatKES(parcel.price / parcel.sizeAcres)} / acre</p>

              {parcel.seller && (
                <div className="mt-4 border-t border-ink-100 pt-4">
                  <p className="text-xs text-ink-400">Listed by</p>
                  <p className="font-medium text-ink-800">{parcel.seller.firstName} {parcel.seller.lastName}</p>
                </div>
              )}

              {canOffer ? (
                <div className="mt-4 space-y-2">
                  <label className="label">Your offer (KES)</label>
                  <input className="input" type="number" value={offer} onChange={(e) => setOffer(e.target.value)} />
                  {msg && <p className="text-sm text-red-600">{msg}</p>}
                  <button className="btn-primary w-full py-2.5" onClick={makeOffer} disabled={busy}>Make an offer</button>
                  <p className="text-xs text-ink-400">Your offer proceeds through seller acceptance and government approval before any payment.</p>
                </div>
              ) : !user ? (
                <Link href="/login" className="btn-primary mt-4 w-full py-2.5">Sign in to make an offer</Link>
              ) : user.role !== 'BUYER' ? (
                <p className="mt-4 text-sm text-ink-400">Sign in as a buyer to make an offer.</p>
              ) : (
                <p className="mt-4 text-sm text-ink-400">This parcel is not currently open for offers.</p>
              )}
            </div>

            {/* Risk & QR (owner/official) */}
            {(user?.role === 'ADMIN' || user?.role === 'GOVERNMENT_OFFICER' || user?.id === parcel.sellerId) && (
              <div className="card p-5">
                <p className="text-sm text-ink-500">Fraud risk score</p>
                <p className={`text-2xl font-bold ${risk.className}`}>{parcel.riskScore}/100</p>
                <p className={`text-sm ${risk.className}`}>{risk.label}</p>
              </div>
            )}

            {parcel.qrCodes && parcel.qrCodes.length > 0 && (
              <Link href={`/verify/${parcel.qrCodes[0].code}`} className="card flex items-center gap-3 p-4 hover:border-brand-300">
                <QrCode className="h-8 w-8 text-brand-600" />
                <div>
                  <p className="font-medium text-ink-800">Verify this parcel</p>
                  <p className="text-xs text-ink-400">Scan-free QR verification</p>
                </div>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
