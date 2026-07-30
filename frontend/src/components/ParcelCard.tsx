import Link from 'next/link';
import { MapPin, Ruler, ShieldCheck } from 'lucide-react';
import type { Parcel } from '@/lib/types';
import { Badge } from './ui';
import { formatKES, prettyStatus } from '@/lib/utils';

export function ParcelCard({ parcel, href }: { parcel: Parcel; href?: string }) {
  return (
    <Link href={href ?? `/marketplace/${parcel.id}`} className="card overflow-hidden transition hover:border-brand-300 hover:shadow-md">
      <div className="relative h-40 w-full bg-ink-100">
        {parcel.featuredImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={parcel.featuredImage} alt={parcel.locality} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-300"><MapPin className="h-8 w-8" /></div>
        )}
        <div className="absolute left-2 top-2"><Badge status={parcel.status}>{prettyStatus(parcel.status)}</Badge></div>
        {(parcel.status === 'LISTED' || parcel.status === 'VERIFIED') && (
          <div className="absolute right-2 top-2 badge bg-white/90 text-brand-700"><ShieldCheck className="mr-1 h-3 w-3" /> Verified</div>
        )}
      </div>
      <div className="p-4">
        <p className="text-lg font-semibold text-brand-700">{formatKES(parcel.price)}</p>
        <p className="mt-0.5 line-clamp-1 font-medium text-ink-900">{parcel.locality}, {parcel.county}</p>
        <p className="mt-1 line-clamp-2 text-sm text-ink-500">{parcel.description}</p>
        <div className="mt-3 flex items-center gap-4 text-xs text-ink-500">
          <span className="inline-flex items-center gap-1"><Ruler className="h-3.5 w-3.5" /> {parcel.sizeAcres} acres</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {parcel.subCounty}</span>
          <span className="ml-auto text-ink-400">{prettyStatus(parcel.landUse)}</span>
        </div>
      </div>
    </Link>
  );
}
