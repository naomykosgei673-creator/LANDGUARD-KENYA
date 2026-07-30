import { cn, statusStyles, prettyStatus } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const key = status ?? '';
  return (
    <span className={cn('badge', statusStyles[key] ?? 'bg-ink-100 text-ink-600')}>
      {children ?? prettyStatus(key)}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card p-5', className)}>{children}</div>;
}

export function StatCard({ label, value, icon, accent }: { label: string; value: ReactNode; icon?: ReactNode; accent?: string }) {
  return (
    <div className="card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
        </div>
        {icon && <div className={cn('shrink-0 rounded-xl p-2.5', accent ?? 'bg-brand-50 text-brand-600')}>{icon}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin', className)} />;
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center text-ink-400">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1 p-10 text-center">
      <p className="font-medium text-ink-700">{title}</p>
      {hint && <p className="text-sm text-ink-400">{hint}</p>}
    </div>
  );
}
