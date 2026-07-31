'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { useAuth } from '@/lib/auth';
import { Badge, PageLoader, EmptyState } from '@/components/ui';
import { formatKES, formatDate, prettyStatus } from '@/lib/utils';
import type { Transaction } from '@/lib/types';

export default function Transactions() {
  const { user } = useAuth();
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setItems(await apiGet<Transaction[]>('/transactions')); setLoading(false); }, []);
  useAutoRefresh(load);
  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Transactions</h1>
        <p className="text-ink-500">Offers, approvals, payments and completed transfers.</p>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No transactions yet" hint={user?.role === 'BUYER' ? 'Make an offer on a verified parcel to begin.' : 'Offers on your parcels will appear here.'} />
      ) : (
        <div className="card divide-y divide-ink-100">
          {items.map((t) => (
            <Link key={t.id} href={`/dashboard/transactions/${t.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-ink-50">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-50 p-2 text-brand-600"><ArrowLeftRight className="h-5 w-5" /></div>
                <div>
                  <p className="font-medium text-ink-900">{t.parcel?.parcelNumber} · {t.parcel?.locality}</p>
                  <p className="text-sm text-ink-500">
                    {user?.role === 'SELLER' ? `Buyer: ${t.buyer?.firstName} ${t.buyer?.lastName}` : `Seller: ${t.seller?.firstName} ${t.seller?.lastName}`} · {formatDate(t.createdAt)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-ink-900">{formatKES(t.offerAmount)}</p>
                <Badge status={t.status}>{prettyStatus(t.status)}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
