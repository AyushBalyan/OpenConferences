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
import { useSidebarOptional } from './sidebar-context';

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center rounded-md border-l-2 text-sm font-medium transition-colors',
        collapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2',
        active
          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
          : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" />
      {!collapsed ? label : null}
    </Link>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const [conferences, setConferences] = useState<Conference[]>([]);
  const sidebar = useSidebarOptional();
  const collapsed = sidebar?.collapsed ?? false;

  useEffect(() => {
    fetchConferences()
      .then((result) => setConferences(result.data))
      .catch(() => setConferences([]));
  }, []);

  const showCreate = conferences.some((c) => canCreateConference(c.myRoles ?? []));

  return (
    <div className="flex h-full flex-col">
      <div className={cn('border-b border-slate-200', collapsed ? 'p-2' : 'p-4')}>
        {!collapsed ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Workspace
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">FresiCMT</p>
          </>
        ) : null}
      </div>

      <nav className={cn('flex-1 space-y-1', collapsed ? 'p-2' : 'p-4')}>
        {!collapsed ? (
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Navigation
          </p>
        ) : null}
        <SidebarLink
          href="/me/dashboard"
          label="Home"
          icon={Home}
          active={pathname === '/me/dashboard' || pathname === '/dashboard'}
          collapsed={collapsed}
        />
        {showCreate ? (
          <SidebarLink
            href="/dashboard/conferences/new"
            label="Create conference"
            icon={Plus}
            active={pathname === '/dashboard/conferences/new'}
            collapsed={collapsed}
          />
        ) : null}
      </nav>

      {conferences.length > 0 && !collapsed ? (
        <div className="space-y-2 border-t border-slate-200 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Quick switch
          </p>
          <ConferenceSwitcher conferences={conferences} />
        </div>
      ) : null}

      <div className={cn('mt-auto border-t border-slate-200', collapsed ? 'p-2' : 'p-4')}>
        <Link
          href="mailto:contact@fresi.org"
          className={cn(
            'flex items-center rounded-md text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900',
            collapsed ? 'justify-center p-2' : 'gap-2 px-3 py-2',
          )}
          title={collapsed ? 'Help & support' : undefined}
        >
          <HelpCircle className="h-4 w-4" />
          {!collapsed ? 'Help & support' : null}
        </Link>
      </div>
    </div>
  );
}
