import clsx, { type ClassValue } from 'clsx';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// Human labels + tailwind classes for statuses.
export const statusStyles: Record<string, string> = {
  DRAFT: 'bg-ink-100 text-ink-600',
  PENDING_ADMIN: 'bg-amber-100 text-amber-700',
  PENDING_GOVERNMENT: 'bg-blue-100 text-blue-700',
  PENDING_SURVEY: 'bg-indigo-100 text-indigo-700',
  VERIFIED: 'bg-brand-100 text-brand-700',
  LISTED: 'bg-brand-100 text-brand-700',
  UNDER_OFFER: 'bg-purple-100 text-purple-700',
  SOLD: 'bg-ink-800 text-white',
  REJECTED: 'bg-red-100 text-red-700',
  FLAGGED: 'bg-red-100 text-red-700',
  // transactions
  OFFER_MADE: 'bg-amber-100 text-amber-700',
  ACCEPTED: 'bg-blue-100 text-blue-700',
  GOV_APPROVAL_PENDING: 'bg-indigo-100 text-indigo-700',
  GOV_APPROVED: 'bg-blue-100 text-blue-700',
  PAYMENT_PENDING: 'bg-purple-100 text-purple-700',
  PAID: 'bg-brand-100 text-brand-700',
  COMPLETED: 'bg-brand-600 text-white',
  CANCELLED: 'bg-red-100 text-red-700',
  // severity
  LOW: 'bg-ink-100 text-ink-600',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
  // doc
  PENDING: 'bg-amber-100 text-amber-700',
};

export function prettyStatus(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function riskBand(score: number): { label: string; className: string } {
  if (score >= 60) return { label: 'High risk', className: 'text-red-600' };
  if (score >= 30) return { label: 'Medium risk', className: 'text-amber-600' };
  return { label: 'Low risk', className: 'text-brand-600' };
}

export const roleLabels: Record<string, string> = {
  BUYER: 'Buyer', SELLER: 'Seller', ADMIN: 'Administrator',
  GOVERNMENT_OFFICER: 'Government Officer', SURVEYOR: 'Surveyor',
};

// Per-role colour identity — used for avatars, the topbar chip and the sidebar
// accent so each account's tab looks distinct during a multi-tab presentation.
export const roleAccent: Record<string, { avatar: string; chip: string; bar: string; label: string }> = {
  ADMIN:              { avatar: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', bar: 'bg-emerald-500', label: 'Administrator' },
  GOVERNMENT_OFFICER: { avatar: 'bg-indigo-600',  chip: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',   bar: 'bg-indigo-500',  label: 'Gov. Officer' },
  SURVEYOR:           { avatar: 'bg-purple-600',  chip: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',   bar: 'bg-purple-500',  label: 'Surveyor' },
  SELLER:             { avatar: 'bg-blue-600',    chip: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',         bar: 'bg-blue-500',    label: 'Seller' },
  BUYER:              { avatar: 'bg-amber-500',   chip: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',      bar: 'bg-amber-500',   label: 'Buyer' },
};

export function accentFor(role: string) {
  return roleAccent[role] ?? roleAccent.BUYER;
}
