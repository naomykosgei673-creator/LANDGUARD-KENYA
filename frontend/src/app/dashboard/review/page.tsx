'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, ShieldAlert, FileText, Loader2, ScanSearch, ExternalLink } from 'lucide-react';
import { apiGet, apiPost, apiError } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { useAuth } from '@/lib/auth';
import { Badge, PageLoader, EmptyState } from '@/components/ui';
import { formatKES, prettyStatus } from '@/lib/utils';

const STAGE_LABEL: Record<string, string> = {
  ADMIN_REVIEW: 'Admin review', GOVERNMENT_VERIFICATION: 'Government verification', SURVEY_APPROVAL: 'Survey approval',
};

export default function ReviewQueue() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setRecords(await apiGet<any[]>('/verification/queue')); } catch { setRecords([]); }
    setLoading(false);
  }, []);
  useAutoRefresh(load);

  async function decide(parcelId: string, stage: string, decision: 'APPROVE' | 'REJECT') {
    setBusy(parcelId + decision);
    try {
      await apiPost(`/verification/${parcelId}/${stage}/decision`, { decision, notes: notes[parcelId] });
      await load();
    } catch (e) { alert(apiError(e)); } finally { setBusy(null); }
  }

  async function scan(parcelId: string) {
    setBusy(parcelId + 'scan');
    try { const r = await apiPost<any>(`/parcels/${parcelId}/fraud-scan`, {}); alert(`Risk score: ${r.riskScore}/100 · ${r.flags.length} flag(s)`); await load(); }
    catch (e) { alert(apiError(e)); } finally { setBusy(null); }
  }

  async function viewDoc(doc: any) {
    try {
      const res = await apiGet<any>(`/documents/${doc.id}/content`);
      if (res.contentBase64) {
        const dataUrl = `data:${res.mimeType};base64,${res.contentBase64}`;

        // Use a more reliable way to open PDFs and images
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

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Verification Queue</h1>
        <p className="text-ink-500">Parcels awaiting your {user?.role === 'SURVEYOR' ? 'survey approval' : user?.role === 'GOVERNMENT_OFFICER' ? 'government verification' : 'review'}.</p>
      </div>

      {records.length === 0 ? (
        <EmptyState title="Queue is clear 🎉" hint="No parcels are waiting for your action right now." />
      ) : (
        <div className="space-y-4">
          {records.map((r) => {
            const p = r.parcel;
            const flags = p._count?.fraudFlags ?? 0;
            return (
              <div key={r.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-ink-900">{p.locality}, {p.county}</h3>
                      <Badge>{STAGE_LABEL[r.stage]}</Badge>
                      {p.seller?.isBlacklisted && <span className="badge bg-red-100 text-red-700"><ShieldAlert className="mr-1 h-3 w-3" /> Blacklisted seller</span>}
                      {flags > 0 && <span className="badge bg-red-100 text-red-700">{flags} fraud flag(s)</span>}
                    </div>
                    <p className="text-sm text-ink-500">Parcel {p.parcelNumber} · Title {p.titleDeedNumber} · {formatKES(p.price)}</p>
                    <p className="mt-1 text-sm text-ink-500">Seller: {p.seller?.firstName} {p.seller?.lastName} · {p.documents?.length ?? 0} document(s)</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.documents?.map((d: any) => (
                        <button key={d.id} onClick={() => viewDoc(d)} className="inline-flex items-center gap-1 rounded border border-ink-200 bg-white px-2 py-1 text-xs font-medium text-ink-600 hover:bg-ink-50 hover:text-brand-600 transition-colors">
                          <FileText className="h-3 w-3" /> {prettyStatus(d.type)} <ExternalLink className="h-2.5 w-2.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <Link href={`/marketplace/${p.id}`} className="btn-secondary">Inspect</Link>
                </div>

                <input className="input mt-4" placeholder="Reviewer notes (required to reject)…" value={notes[p.id] ?? ''} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={busy === p.id + 'APPROVE'} onClick={() => decide(p.id, r.stage, 'APPROVE')}>
                    {busy === p.id + 'APPROVE' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
                  </button>
                  <button className="btn-danger" disabled={busy === p.id + 'REJECT'} onClick={() => decide(p.id, r.stage, 'REJECT')}>
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                  <button className="btn-secondary" disabled={busy === p.id + 'scan'} onClick={() => scan(p.id)}>
                    <ScanSearch className="h-4 w-4" /> Run fraud scan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
