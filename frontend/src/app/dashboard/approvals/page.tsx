'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { apiGetRaw } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { PageLoader, EmptyState, Badge } from '@/components/ui';
import { formatKES, formatDate } from '@/lib/utils';
import type { Transaction } from '@/lib/types';

export default function Approvals() {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await apiGetRaw<{ data: Transaction[] }>('/transactions', { pending: true });
    setItems(r.data); setLoading(false);
  }, []);
  useAutoRefresh(load);
  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Transfer Approvals</h1>
        <p className="text-ink-500">Accepted sales awaiting government approval before payment.</p>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No transfers awaiting approval" hint="Accepted offers appear here for government sign-off." />
      ) : (
        <div className="card divide-y divide-ink-100">
          {items.map((t) => (
            <Link key={t.id} href={`/dashboard/transactions/${t.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-ink-50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-50 p-2 text-brand-600"><Landmark className="h-5 w-5" /></div>
                <div>
                  <p className="font-medium text-ink-900">{t.parcel?.parcelNumber} · {t.parcel?.locality}</p>
                  <p className="text-sm text-ink-500">{t.buyer?.firstName} {t.buyer?.lastName} → buying from {t.seller?.firstName} {t.seller?.lastName} · {formatDate(t.createdAt)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink-900">{formatKES(t.offerAmount)}</p>
                <Badge status={t.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
