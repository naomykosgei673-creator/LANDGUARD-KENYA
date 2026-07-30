'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Upload, Send, FileText, AlertTriangle, Loader2 } from 'lucide-react';
import { apiGet, apiPost, apiError } from '@/lib/api';
import { Badge, PageLoader, EmptyState } from '@/components/ui';
import { formatKES, prettyStatus } from '@/lib/utils';
import type { Parcel } from '@/lib/types';

const DOC_TYPES = ['TITLE_DEED', 'SURVEY_MAP', 'NATIONAL_ID', 'LAND_SEARCH', 'CONSENT', 'RATES_CLEARANCE'];

export default function MyParcels() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    setParcels(await apiGet<Parcel[]>('/parcels/mine'));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit(id: string) {
    setMsg(null);
    try {
      const res = await apiPost<any>(`/parcels/${id}/submit`, {});
      setMsg({ id, text: `Submitted for verification (risk score ${res.riskScore}/100).` });
      load();
    } catch (e) { setMsg({ id, text: apiError(e), error: true }); }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">My Parcels</h1>
          <p className="text-ink-500">List, document and submit your land for verification.</p>
        </div>
        <Link href="/dashboard/parcels/new" className="btn-primary"><Plus className="h-4 w-4" /> New parcel</Link>
      </div>

      {parcels.length === 0 ? (
        <EmptyState title="You haven't listed any parcels yet" hint="Click 'New parcel' to get started." />
      ) : (
        <div className="space-y-4">
          {parcels.map((p) => (
            <div key={p.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{p.locality}, {p.county}</h3>
                    <Badge status={p.status}>{prettyStatus(p.status)}</Badge>
                    {p.riskScore >= 60 && <span className="badge bg-red-100 text-red-700"><AlertTriangle className="mr-1 h-3 w-3" /> Risk {p.riskScore}</span>}
                  </div>
                  <p className="text-sm text-ink-500">Parcel {p.parcelNumber} · {formatKES(p.price)} · {p.sizeAcres} acres</p>
                  <p className="mt-1 text-sm text-ink-500"><FileText className="mr-1 inline h-3.5 w-3.5" /> {p.documents?.length ?? 0} document(s) attached</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/marketplace/${p.id}`} className="btn-secondary">View</Link>
                  <button className="btn-secondary" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
                    <Upload className="h-4 w-4" /> Add document
                  </button>
                  {['DRAFT', 'REJECTED'].includes(p.status) && (
                    <button className="btn-primary" onClick={() => submit(p.id)}><Send className="h-4 w-4" /> Submit for verification</button>
                  )}
                </div>
              </div>

              {msg?.id === p.id && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.error ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'}`}>{msg.text}</div>
              )}

              {openId === p.id && <UploadForm parcelId={p.id} onDone={() => { setOpenId(null); load(); }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadForm({ parcelId, onDone }: { parcelId: string; onDone: () => void }) {
  const [type, setType] = useState('TITLE_DEED');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErr('Please select a file');
      return;
    }
    setBusy(true); setErr('');
    try {
      const reader = new FileReader();
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      await apiPost('/documents', {
        parcelId,
        type,
        fileName: file.name,
        fileUrl: `local://docs/${parcelId}/${Date.now()}-${file.name}`,
        contentBase64,
        mimeType: file.type,
      });
      onDone();
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={upload} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-ink-200 p-4">
      <div>
        <label className="label">Document type</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {DOC_TYPES.map((t) => <option key={t} value={t}>{prettyStatus(t)}</option>)}
        </select>
      </div>
      <div className="flex-1">
        <label className="label">File</label>
        <input
          type="file"
          className="input pt-1.5"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          accept=".pdf,.jpg,.jpeg,.png"
        />
      </div>
      <button className="btn-primary" disabled={busy || !file}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Upload</button>
      {err && <p className="w-full text-sm text-red-600">{err}</p>}
    </form>
  );
}
