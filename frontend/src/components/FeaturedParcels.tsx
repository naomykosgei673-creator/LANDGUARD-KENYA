'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Search, ShieldCheck } from 'lucide-react';
import { apiGetRaw } from '@/lib/api';
import type { Paginated, Parcel } from '@/lib/types';
import { ParcelCard } from './ParcelCard';

export function FeaturedParcels() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGetRaw<Paginated<Parcel>>('/parcels', { pageSize: 3 })
      .then((result) => setParcels(result.data))
      .catch(() => setParcels([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="bg-ink-50 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
              <ShieldCheck className="h-4 w-4" /> Government-verified marketplace
            </span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-900">Featured land for sale</h2>
            <p className="mt-2 max-w-2xl text-ink-600">
              Explore verified listings with clear property details before creating an account to make an offer.
            </p>
          </div>
          <Link href="/marketplace" className="btn-secondary w-fit">
            View all land <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center rounded-2xl border border-ink-200 bg-white text-sm text-ink-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand-600" /> Loading verified listings…
            </div>
          ) : parcels.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {parcels.map((parcel) => <ParcelCard key={parcel.id} parcel={parcel} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-300 bg-white px-6 py-12 text-center">
              <Search className="mx-auto h-7 w-7 text-ink-400" />
              <p className="mt-3 font-medium text-ink-700">New verified listings are coming soon.</p>
              <Link href="/marketplace" className="mt-4 inline-flex text-sm font-medium text-brand-700 hover:text-brand-800">
                Browse the marketplace <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-brand-100 bg-white px-5 py-4 text-center sm:flex-row sm:text-left">
          <p className="text-sm text-ink-600">Want to make an offer? Create a free buyer account to start a secure transaction.</p>
          <Link href="/register" className="btn-primary shrink-0">Create an account</Link>
        </div>
      </div>
    </section>
  );
}
