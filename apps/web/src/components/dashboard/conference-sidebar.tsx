'use client';

import { ArrowLeft, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navGroupsForRoles, navItemIcon } from '@/lib/roles';
import { ConferenceSidebarList } from './conference-sidebar-list';
import { SidebarNavItem } from './sidebar-nav-item';
import { useConferenceWorkspace } from './conference-workspace';
import { useSidebarOptional } from './sidebar-context';
import { cn } from '@/lib/utils';

export function ConferenceSidebar() {
  const pathname = usePathname();
  const { conferenceId, conference, conferences } = useConferenceWorkspace();
  const roles = conference?.myRoles ?? [];
  const groups = navGroupsForRoles(roles);
  const sidebar = useSidebarOptional();
  const collapsed = sidebar?.collapsed ?? false;

  return (
    <div className="flex h-full flex-col">
      <div className={cn('space-y-4 border-b border-slate-200', collapsed ? 'p-2' : 'p-4')}>
        {!collapsed ? (
          <Link
            href="/me/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-500 transition-colors hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            All conferences
          </Link>
        ) : (
          <Link
            href="/me/dashboard"
            className="flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="All conferences"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        )}

        {conferences.length > 0 && !collapsed ? (
          <ConferenceSidebarList conferences={conferences} currentId={conferenceId} />
        ) : null}
      </div>

      <nav className={cn('flex-1 space-y-6 overflow-y-auto', collapsed ? 'p-2' : 'p-4')}>
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            {!collapsed ? (
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.label}
              </p>
            ) : null}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <SidebarNavItem
                  key={item.label}
                  item={item}
                  conferenceId={conferenceId}
                  pathname={pathname}
                  icon={navItemIcon(item.label)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

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
