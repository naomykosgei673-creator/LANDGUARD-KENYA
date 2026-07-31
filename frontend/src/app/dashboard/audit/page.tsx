'use client';

import { useState, useCallback } from 'react';
import { ScrollText } from 'lucide-react';
import { apiGetRaw } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { PageLoader, EmptyState, Badge } from '@/components/ui';
import { prettyStatus, timeAgo } from '@/lib/utils';
import type { Paginated } from '@/lib/types';

interface Log {
  id: string; action: string; entity: string; entityId?: string; ipAddress?: string;
  createdAt: string; user?: { firstName: string; lastName: string; role: string };
}

export default function Audit() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [entity, setEntity] = useState('');

  const load = useCallback(async () => {
    const r = await apiGetRaw<Paginated<Log>>('/audit', entity ? { entity, pageSize: 100 } : { pageSize: 100 });
    setLogs(r.data); setLoading(false);
  }, [entity]);
  useAutoRefresh(load);

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Audit Trail</h1>
        <p className="text-ink-500">Immutable log of every security-relevant action on the platform.</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-500">Entity:</span>
        {['', 'User', 'LandParcel', 'Transaction', 'Payment', 'Document', 'FraudFlag'].map((e) => (
          <button key={e} onClick={() => setEntity(e)} className={`badge ${entity === e ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-600'}`}>{e || 'All'}</button>
        ))}
      </div>

      {logs.length === 0 ? <EmptyState title="No audit entries" /> : (
        <div className="card divide-y divide-ink-100">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3 p-3">
              <div className="mt-0.5 rounded-lg bg-ink-100 p-2 text-ink-500"><ScrollText className="h-4 w-4" /></div>
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-800">{prettyStatus(l.action)} <Badge>{l.entity}</Badge></p>
                <p className="text-xs text-ink-400">
                  {l.user ? `${l.user.firstName} ${l.user.lastName} (${l.user.role})` : 'System'} · {l.ipAddress ?? '—'} · {timeAgo(l.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
