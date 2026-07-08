'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, Home, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { fetchConferences } from '@/lib/api-client';
import { canCreateConference } from '@/lib/roles';
import type { Conference } from '@/lib/conference-types';
import { ConferenceSwitcher } from './conference-switcher';
function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2.5 rounded-md border-l-2 px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
          : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      {label}
    </Link>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const [conferences, setConferences] = useState<Conference[]>([]);

  useEffect(() => {
    fetchConferences()
      .then((result) => setConferences(result.data))
      .catch(() => setConferences([]));
  }, []);

  const showCreate = conferences.some((c) => canCreateConference(c.myRoles ?? []));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">OpenConferences</p>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </p>
        <SidebarLink
          href="/me/dashboard"
          label="Home"
          icon={Home}
          active={pathname === '/me/dashboard' || pathname === '/dashboard'}
        />
        {showCreate ? (
          <SidebarLink
            href="/dashboard/conferences/new"
            label="Create conference"
            icon={Plus}
            active={pathname === '/dashboard/conferences/new'}
          />
        ) : null}
      </nav>

      {conferences.length > 0 ? (
        <div className="space-y-2 border-t border-slate-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick switch
          </p>
          <ConferenceSwitcher conferences={conferences} />
        </div>
      ) : null}

      <div className="mt-auto space-y-3 border-t border-slate-200 p-4">
        <Link
          href="mailto:support@openconferences.local"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <HelpCircle className="h-4 w-4" />
          Help & support
        </Link>
      </div>
    </div>
  );
}
