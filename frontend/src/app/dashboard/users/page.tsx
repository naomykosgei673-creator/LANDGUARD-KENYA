'use client';

import { useState, useCallback } from 'react';
import { Ban, ShieldCheck, Search, Loader2 } from 'lucide-react';
import { apiGetRaw, apiPost, apiError } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { PageLoader, EmptyState, Badge } from '@/components/ui';
import { roleLabels } from '@/lib/utils';
import type { User, Paginated } from '@/lib/types';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await apiGetRaw<Paginated<User>>('/users', { q, pageSize: 50 });
    setUsers(r.data); setLoading(false);
  }, [q]);
  useAutoRefresh(load);

  async function toggleBlacklist(u: User) {
    const blacklisted = !u.isBlacklisted;
    let reason: string | undefined;
    if (blacklisted) {
      const answer = prompt('Reason for blacklisting this user?');
      if (answer === null) return; // cancelled — do nothing
      reason = answer || 'Flagged by administrator';
    }
    setBusyId(u.id);
    // Optimistic: reflect the new status immediately.
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isBlacklisted: blacklisted } : x)));
    try { await apiPost(`/users/${u.id}/blacklist`, { blacklisted, reason }); }
    catch (e) { alert(apiError(e)); }
    finally { setBusyId(null); load(); }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Users</h1>
        <p className="text-ink-500">Manage accounts, roles and blacklist status.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
        <input className="input pl-9" placeholder="Search by name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {users.length === 0 ? <EmptyState title="No users found" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-ink-100 text-left text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-ink-50">
                  <td className="px-4 py-3 font-medium text-ink-900">{u.firstName} {u.lastName}</td>
                  <td className="px-4 py-3 text-ink-600">{u.email}</td>
                  <td className="px-4 py-3"><Badge>{roleLabels[u.role]}</Badge></td>
                  <td className="px-4 py-3">
                    {u.isBlacklisted ? <span className="badge bg-red-100 text-red-700">Blacklisted</span> : <span className="badge bg-brand-100 text-brand-700">{u.status}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className={u.isBlacklisted ? 'btn-secondary' : 'btn-danger'} disabled={busyId === u.id} onClick={() => toggleBlacklist(u)}>
                      {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : u.isBlacklisted ? <><ShieldCheck className="h-4 w-4" /> Lift</> : <><Ban className="h-4 w-4" /> Blacklist</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
