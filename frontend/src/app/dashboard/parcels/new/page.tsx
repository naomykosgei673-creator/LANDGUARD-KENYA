'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { apiPost, apiError } from '@/lib/api';

export default function NewParcel() {
  const router = useRouter();
  const [f, setF] = useState({
    parcelNumber: '', titleDeedNumber: '', county: 'Nairobi', subCounty: '', locality: '',
    sizeAcres: '', landUse: 'RESIDENTIAL', price: '', description: '', latitude: '', longitude: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      let featuredImage = undefined;
      if (imageFile) {
        const reader = new FileReader();
        featuredImage = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
      }

      const payload: any = {
        ...f, sizeAcres: Number(f.sizeAcres), price: Number(f.price),
        latitude: f.latitude ? Number(f.latitude) : undefined,
        longitude: f.longitude ? Number(f.longitude) : undefined,
        featuredImage,
      };
      const parcel = await apiPost<any>('/parcels', payload);
      router.push('/dashboard/parcels');
      void parcel;
    } catch (e) { setErr(apiError(e)); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/dashboard/parcels" className="inline-flex items-center gap-2 text-sm text-ink-600 hover:text-ink-900"><ArrowLeft className="h-4 w-4" /> Back to my parcels</Link>
      <div>
        <h1 className="text-2xl font-bold text-ink-900">List a new parcel</h1>
        <p className="text-ink-500">Enter the land details. You'll attach documents and submit for verification next.</p>
      </div>

      {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      <form onSubmit={submit} className="card space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Parcel number</label><input className="input" value={f.parcelNumber} onChange={set('parcelNumber')} placeholder="NAIROBI/BLOCK1/1234" required /></div>
          <div><label className="label">Title deed number</label><input className="input" value={f.titleDeedNumber} onChange={set('titleDeedNumber')} placeholder="TD-NRB-2024-00001" required /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">County</label><input className="input" value={f.county} onChange={set('county')} required /></div>
          <div><label className="label">Sub-county</label><input className="input" value={f.subCounty} onChange={set('subCounty')} required /></div>
          <div><label className="label">Locality</label><input className="input" value={f.locality} onChange={set('locality')} required /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Size (acres)</label><input className="input" type="number" step="0.01" value={f.sizeAcres} onChange={set('sizeAcres')} required /></div>
          <div>
            <label className="label">Land use</label>
            <select className="input" value={f.landUse} onChange={set('landUse')}>
              {['RESIDENTIAL', 'COMMERCIAL', 'AGRICULTURAL', 'INDUSTRIAL'].map((u) => <option key={u} value={u}>{u[0] + u.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
          <div><label className="label">Price (KES)</label><input className="input" type="number" value={f.price} onChange={set('price')} required /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Latitude (optional)</label><input className="input" type="number" step="any" value={f.latitude} onChange={set('latitude')} placeholder="-1.2921" /></div>
          <div><label className="label">Longitude (optional)</label><input className="input" type="number" step="any" value={f.longitude} onChange={set('longitude')} placeholder="36.8219" /></div>
        </div>
        <div>
          <label className="label">Featured image (optional)</label>
          <input
            type="file"
            className="input pt-1.5"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            accept="image/*"
          />
          {imageFile && <p className="mt-1 text-xs text-brand-600">Selected: {imageFile.name}</p>}
        </div>
        <div><label className="label">Description</label><textarea className="input min-h-[100px]" value={f.description} onChange={set('description')} placeholder="Describe the land, access, services, and any features…" required /></div>
        <button className="btn-primary w-full py-2.5" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create parcel</button>
      </form>
    </div>
  );
}
