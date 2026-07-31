'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, ShieldAlert, CheckCircle2, Info, AlertTriangle } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { PageLoader, EmptyState } from '@/components/ui';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/lib/types';

const ICONS: Record<string, any> = { FRAUD_ALERT: ShieldAlert, SUCCESS: CheckCircle2, WARNING: AlertTriangle, TRANSACTION: Bell, INFO: Info };

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const d = await apiGet<{ items: Notification[] }>('/notifications');
    setItems(d.items); setLoading(false);
  }, []);
  useAutoRefresh(load);

  // Optimistic: flip the UI immediately, reconcile with the server in the background.
  function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    apiPost('/notifications/read-all', {}).catch(() => {});
  }
  function open(n: Notification) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      apiPost(`/notifications/${n.id}/read`, {}).catch(() => {});
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Notifications</h1>
          <p className="text-ink-500">Verification updates, offers, payments and fraud alerts.</p>
        </div>
        <button className="btn-secondary" onClick={markAll}><CheckCheck className="h-4 w-4" /> Mark all read</button>
      </div>

      {items.length === 0 ? (
        <EmptyState title="You're all caught up" hint="New notifications will appear here." />
      ) : (
        <div className="card divide-y divide-ink-100">
          {items.map((n) => {
            const Icon = ICONS[n.type] ?? Info;
            const body = (
              <div className={`flex items-start gap-3 p-4 ${!n.read ? 'bg-brand-50/40' : ''}`}>
                <div className={`rounded-lg p-2 ${n.type === 'FRAUD_ALERT' || n.type === 'WARNING' ? 'bg-red-50 text-red-600' : n.type === 'SUCCESS' ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-500'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-ink-900">{n.title} {!n.read && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-brand-500" />}</p>
                  <p className="text-sm text-ink-600">{n.body}</p>
                  <p className="mt-0.5 text-xs text-ink-400">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} onClick={() => open(n)}>{body}</Link>
            ) : (
              <button key={n.id} className="block w-full text-left" onClick={() => open(n)}>{body}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
