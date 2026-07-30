'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Shield, Search, SlidersHorizontal } from 'lucide-react';
import { apiGetRaw } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ParcelCard } from '@/components/ParcelCard';
import { PageLoader, EmptyState } from '@/components/ui';
import type { Parcel, Paginated } from '@/lib/types';

const COUNTIES = ['', 'Nairobi', 'Kiambu', 'Nakuru', 'Mombasa', 'Machakos', 'Kajiado', 'Kisumu'];
const USES = ['', 'RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 'INDUSTRIAL'];

export default function Marketplace() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', county: '', landUse: '', maxPrice: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const params: any = { pageSize: 24 };
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    const res = await apiGetRaw<Paginated<Parcel>>('/parcels', params);
    setParcels(res.data);
    setTotal(res.pagination.total);
    setLoading(false);
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-20 border-b border-ink-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
            <Shield className="h-6 w-6 text-brand-600" /> LandGuard <span className="text-brand-600">Kenya</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {user ? <Link href="/dashboard" className="btn-primary">Dashboard</Link>
              : <><Link href="/login" className="btn-secondary">Sign in</Link><Link href="/register" className="btn-primary">Get started</Link></>}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-ink-900">Verified land marketplace</h1>
        <p className="text-ink-500">{total} government-verified parcel{total === 1 ? '' : 's'} available.</p>

        {/* Filters */}
        <div className="card mt-5 flex flex-wrap items-end gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <label className="label">Search</label>
            <Search className="absolute left-3 top-9 h-4 w-4 text-ink-400" />
            <input className="input pl-9" placeholder="Parcel no, locality, county…" value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          </div>
          <div>
            <label className="label">County</label>
            <select className="input" value={filters.county} onChange={(e) => setFilters({ ...filters, county: e.target.value })}>
              {COUNTIES.map((c) => <option key={c} value={c}>{c || 'All counties'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Land use</label>
            <select className="input" value={filters.landUse} onChange={(e) => setFilters({ ...filters, landUse: e.target.value })}>
              {USES.map((u) => <option key={u} value={u}>{u ? u[0] + u.slice(1).toLowerCase() : 'Any use'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Max price (KES)</label>
            <input className="input w-40" type="number" placeholder="e.g. 10000000" value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} />
          </div>
          <button className="btn-secondary" onClick={() => setFilters({ q: '', county: '', landUse: '', maxPrice: '' })}>
            <SlidersHorizontal className="h-4 w-4" /> Reset
          </button>
        </div>

        {/* Grid */}
        <div className="mt-6">
          {loading ? <PageLoader /> : parcels.length === 0 ? (
            <EmptyState title="No parcels match your filters" hint="Try widening your search." />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {parcels.map((p) => <ParcelCard key={p.id} parcel={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
