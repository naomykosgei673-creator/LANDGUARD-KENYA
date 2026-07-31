'use client';

import { useState, useCallback } from 'react';
import { ShieldAlert, ShieldCheck, AlertOctagon, MapPinned, Check } from 'lucide-react';
import { apiGet, apiGetRaw, apiPost } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { StatCard, PageLoader, EmptyState, Badge } from '@/components/ui';
import { prettyStatus, timeAgo } from '@/lib/utils';
import type { FraudFlag, Paginated } from '@/lib/types';

export default function FraudConsole() {
  const [stats, setStats] = useState<any>(null);
  const [flags, setFlags] = useState<FraudFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    const [s, f] = await Promise.all([
      apiGet<any>('/fraud/stats'),
      apiGetRaw<Paginated<FraudFlag>>('/fraud', filter ? { severity: filter, pageSize: 50 } : { pageSize: 50 }),
    ]);
    setStats(s); setFlags(f.data); setLoading(false);
  }, [filter]);
  useAutoRefresh(load);

  function resolve(id: string) {
    // Optimistic: mark resolved instantly, then reconcile stats/list from the server.
    setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, resolved: true } : f)));
    apiPost(`/fraud/${id}/resolve`, {}).then(() => load()).catch(() => load());
  }

  if (loading || !stats) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Fraud Console</h1>
        <p className="text-ink-500">AI risk-scored flags across all parcels, documents and users.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total flags" value={stats.total} icon={<ShieldAlert className="h-5 w-5" />} />
        <StatCard label="Unresolved" value={stats.unresolved} icon={<AlertOctagon className="h-5 w-5" />} accent="bg-amber-50 text-amber-600" />
        <StatCard label="Critical (open)" value={stats.critical} icon={<AlertOctagon className="h-5 w-5" />} accent="bg-red-50 text-red-600" />
        <StatCard label="Flagged parcels" value={stats.flaggedParcels} icon={<MapPinned className="h-5 w-5" />} accent="bg-red-50 text-red-600" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-500">Filter:</span>
        {['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`badge ${filter === s ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {flags.length === 0 ? (
        <EmptyState title="No fraud flags" hint="Nothing matches this filter." />
      ) : (
        <div className="card divide-y divide-ink-100">
          {flags.map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-4 p-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 rounded-lg p-2 ${f.resolved ? 'bg-ink-100 text-ink-400' : 'bg-red-50 text-red-600'}`}>
                  {f.resolved ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink-800">{prettyStatus(f.type)}</span>
                    <Badge status={f.severity}>{f.severity}</Badge>
                    <span className="text-xs text-ink-400">+{f.score} risk · {timeAgo(f.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{f.description}</p>
                  {f.parcel && <p className="mt-0.5 text-xs text-ink-400">Parcel {f.parcel.parcelNumber} · {f.parcel.county} · score {f.parcel.riskScore}/100</p>}
                </div>
              </div>
              {!f.resolved && (
                <button className="btn-secondary shrink-0" onClick={() => resolve(f.id)}><Check className="h-4 w-4" /> Resolve</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
