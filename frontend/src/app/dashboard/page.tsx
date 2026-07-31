'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Landmark, ShieldAlert, ArrowLeftRight, Store, ClipboardCheck, CheckCircle2, Wallet, MapPin, ScrollText } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import { useAutoRefresh } from '@/lib/useAutoRefresh';
import { StatCard, PageLoader } from '@/components/ui';
import { formatKES, roleLabels } from '@/lib/utils';

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setStats(await apiGet<any>('/reports/dashboard'));
    setLoading(false);
  }, []);
  useAutoRefresh(load);

  if (loading || !stats) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Welcome, {user?.firstName} 👋</h1>
        <p className="text-ink-500">{roleLabels[user?.role ?? '']} dashboard · {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {(stats.role === 'ADMIN' || stats.role === 'GOVERNMENT_OFFICER') && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total users" value={stats.users} icon={<Users className="h-5 w-5" />} />
            <StatCard label="Parcels registered" value={stats.parcels} icon={<Landmark className="h-5 w-5" />} />
            <StatCard label="Live listings" value={stats.listed} icon={<Store className="h-5 w-5" />} />
            <StatCard label="Flagged (fraud)" value={stats.flagged} icon={<ShieldAlert className="h-5 w-5" />} accent="bg-red-50 text-red-600" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Transactions" value={stats.transactions} icon={<ArrowLeftRight className="h-5 w-5" />} />
            <StatCard label="Completed sales" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Pending approvals" value={stats.pendingApprovals} icon={<ClipboardCheck className="h-5 w-5" />} accent="bg-amber-50 text-amber-600" />
            <StatCard label="Value transacted" value={formatKES(stats.revenue)} icon={<Wallet className="h-5 w-5" />} />
          </div>
          <QuickLinks role={stats.role} openFraud={stats.openFraudFlags} />
        </>
      )}

      {stats.role === 'SELLER' && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard label="My parcels" value={stats.parcels} icon={<Store className="h-5 w-5" />} />
            <StatCard label="Live listings" value={stats.listed} icon={<CheckCircle2 className="h-5 w-5" />} />
            <StatCard label="Under review" value={stats.underReview} icon={<ClipboardCheck className="h-5 w-5" />} accent="bg-amber-50 text-amber-600" />
            <StatCard label="Pending offers" value={stats.pendingOffers} icon={<ArrowLeftRight className="h-5 w-5" />} accent="bg-purple-50 text-purple-600" />
            <StatCard label="Sold" value={stats.sold} icon={<Wallet className="h-5 w-5" />} />
          </div>
          <QuickLinks role={stats.role} />
        </>
      )}

      {stats.role === 'SURVEYOR' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Survey approvals pending" value={stats.surveyQueue} icon={<ClipboardCheck className="h-5 w-5" />} accent="bg-amber-50 text-amber-600" />
          <StatCard label="Upcoming site visits" value={stats.upcomingVisits} icon={<MapPin className="h-5 w-5" />} />
        </div>
      )}

      {stats.role === 'BUYER' && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Offers made" value={stats.offersMade} icon={<ArrowLeftRight className="h-5 w-5" />} />
            <StatCard label="Active transactions" value={stats.activeTransactions} icon={<ClipboardCheck className="h-5 w-5" />} accent="bg-amber-50 text-amber-600" />
            <StatCard label="Parcels owned" value={stats.parcelsOwned} icon={<Landmark className="h-5 w-5" />} />
          </div>
          <QuickLinks role={stats.role} />
        </>
      )}
    </div>
  );
}

function QuickLinks({ role, openFraud }: { role: string; openFraud?: number }) {
  const links: { href: string; label: string; icon: any; badge?: number }[] = [];
  if (role === 'ADMIN' || role === 'GOVERNMENT_OFFICER') {
    links.push({ href: '/dashboard/review', label: 'Review verification queue', icon: ClipboardCheck });
    links.push({ href: '/dashboard/fraud', label: 'Fraud console', icon: ShieldAlert, badge: openFraud });
    links.push({ href: '/dashboard/audit', label: 'Audit trail', icon: ScrollText });
  }
  if (role === 'SELLER') {
    links.push({ href: '/dashboard/parcels/new', label: 'List a new parcel', icon: Store });
    links.push({ href: '/dashboard/parcels', label: 'Manage my parcels', icon: Landmark });
  }
  if (role === 'BUYER') {
    links.push({ href: '/marketplace', label: 'Browse verified land', icon: Store });
    links.push({ href: '/dashboard/transactions', label: 'My transactions', icon: ArrowLeftRight });
  }
  if (!links.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="card flex items-center gap-3 p-4 hover:border-brand-300">
          <div className="rounded-lg bg-brand-50 p-2 text-brand-600"><l.icon className="h-5 w-5" /></div>
          <span className="font-medium text-ink-800">{l.label}</span>
          {l.badge ? <span className="ml-auto badge bg-red-100 text-red-700">{l.badge}</span> : null}
        </Link>
      ))}
    </div>
  );
}
