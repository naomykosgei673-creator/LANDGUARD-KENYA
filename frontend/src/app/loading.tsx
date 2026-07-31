import { Shield } from 'lucide-react';

// Shown by the App Router while a new page or its data is being prepared.
// It makes navigation feel responsive instead of leaving the previous screen frozen.
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-5 py-4 text-sm font-medium text-ink-600 shadow-card">
        <Shield className="h-5 w-5 animate-pulse text-brand-600" />
        Loading your page…
      </div>
    </div>
  );
}
