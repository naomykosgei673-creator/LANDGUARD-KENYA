'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Shield, LayoutDashboard, Store, Search, ClipboardCheck, AlertTriangle,
  ArrowLeftRight, Bell, LogOut, Users, ScrollText, Landmark, Menu,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { cn, roleLabels, accentFor } from '@/lib/utils';

interface NavItem { href: string; label: string; icon: any; roles: string[]; }

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, roles: ['ALL'] },
  { href: '/marketplace', label: 'Marketplace', icon: Search, roles: ['ALL'] },
  { href: '/dashboard/parcels', label: 'My Parcels', icon: Store, roles: ['SELLER'] },
  { href: '/dashboard/review', label: 'Verification Queue', icon: ClipboardCheck, roles: ['ADMIN', 'GOVERNMENT_OFFICER', 'SURVEYOR'] },
  { href: '/dashboard/approvals', label: 'Transfer Approvals', icon: Landmark, roles: ['GOVERNMENT_OFFICER', 'ADMIN'] },
  { href: '/dashboard/transactions', label: 'Transactions', icon: ArrowLeftRight, roles: ['BUYER', 'SELLER', 'ADMIN', 'GOVERNMENT_OFFICER'] },
  { href: '/dashboard/fraud', label: 'Fraud Console', icon: AlertTriangle, roles: ['ADMIN', 'GOVERNMENT_OFFICER'] },
  { href: '/dashboard/users', label: 'Users', icon: Users, roles: ['ADMIN'] },
  { href: '/dashboard/audit', label: 'Audit Trail', icon: ScrollText, roles: ['ADMIN', 'GOVERNMENT_OFFICER'] },
  { href: '/dashboard/notifications', label: 'Notifications', icon: Bell, roles: ['ALL'] },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  // Stamp the role into the browser-tab title so multiple accounts open in
  // different tabs are easy to tell apart during a presentation.
  useEffect(() => {
    if (user) document.title = `${roleLabels[user.role]} · LandGuard`;
  }, [user]);

  // Keep the notification badge live — refetches on an interval, on tab focus,
  // and whenever the route changes (pathname is a dependency of loadUnread).
  const loadUnread = useCallback(async () => {
    if (!user) return;
    try { const d = await apiGet<{ unread: number }>('/notifications'); setUnread(d.unread); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pathname]);
  useAutoRefresh(loadUnread, 10_000, !!user);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-ink-400">
        <Shield className="h-5 w-5 animate-pulse text-brand-500" /> Loading…
      </div>
    );
  }

  const accent = accentFor(user.role);
  const items = NAV.filter((n) => n.roles.includes('ALL') || n.roles.includes(user.role));
  const initials = `${user.firstName[0]}${user.lastName[0]}`;

  const SidebarContent = (
    <>
      <div className="flex items-center gap-2 px-5 py-4 text-lg font-semibold text-white">
        <Shield className="h-6 w-6 text-brand-400" /> LandGuard
      </div>
      {/* Role identity strip */}
      <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg bg-ink-800/60 px-3 py-2">
        <span className={cn('h-2.5 w-2.5 rounded-full', accent.bar)} />
        <span className="text-xs font-medium uppercase tracking-wide text-ink-300">{roleLabels[user.role]}</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)}
              className={cn('group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active ? 'bg-brand-600 font-medium text-white' : 'text-ink-300 hover:bg-ink-800 hover:text-white')}>
              <item.icon className="h-4 w-4 shrink-0" /> <span className="truncate">{item.label}</span>
              {item.href === '/dashboard/notifications' && unread > 0 && (
                <span className="ml-auto rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">{unread}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-ink-800 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white', accent.avatar)}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.firstName} {user.lastName}</p>
            <p className="truncate text-xs text-ink-400">{user.email}</p>
          </div>
        </div>
        <button onClick={logout} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 hover:text-white">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-900 lg:flex">{SidebarContent}</aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[80vw] flex-col bg-ink-900 shadow-2xl">{SidebarContent}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Role accent bar — distinct colour per account (great for multi-tab demos) */}
        <div className={cn('h-1 w-full', accent.bar)} />

        {/* Topbar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-ink-200 bg-white/90 px-4 py-2.5 backdrop-blur">
          <button className="rounded-lg p-1.5 hover:bg-ink-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5 text-ink-700" />
          </button>
          <div className="hidden items-center gap-2 text-sm text-ink-500 sm:flex">
            <Shield className="h-4 w-4 text-brand-600" /> Secure Land Selling &amp; Ownership Verification
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link href="/dashboard/notifications" className="relative rounded-lg p-2 hover:bg-ink-100" aria-label="Notifications">
              <Bell className="h-5 w-5 text-ink-600" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
            </Link>
            {/* Current-account chip — tells you which login this tab is */}
            <div className={cn('flex items-center gap-2 rounded-full py-1 pl-1 pr-3', accent.chip)}>
              <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white', accent.avatar)}>{initials}</span>
              <span className="hidden text-xs font-medium sm:inline">{user.firstName} · {accent.label}</span>
              <span className="text-xs font-medium sm:hidden">{accent.label}</span>
            </div>
          </div>
        </header>

        <main className="animate-in flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
