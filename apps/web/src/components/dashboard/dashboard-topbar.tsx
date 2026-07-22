'use client';

import { usePathname } from 'next/navigation';
import { buildCommandItemsFromNav, buildDashboardBreadcrumbs } from '@/lib/conference-nav';
import { CommandMenu } from '@/components/dashboard/command-menu';
import { DashboardBreadcrumbs } from '@/components/dashboard/dashboard-breadcrumbs';
import { UserMenu } from '@/components/dashboard/user-menu';
import { cn } from '@/lib/utils';

type DashboardTopbarProps = {
  conferenceId?: string;
  conferenceName?: string;
  roles?: string[];
  actions?: React.ReactNode;
  className?: string;
  mobileMenuButton?: React.ReactNode;
  sidebarToggle?: React.ReactNode;
};

export function DashboardTopbar({
  conferenceId,
  conferenceName,
  roles = [],
  actions,
  className,
  mobileMenuButton,
  sidebarToggle,
}: DashboardTopbarProps) {
  const pathname = usePathname();
  const breadcrumbs = buildDashboardBreadcrumbs(pathname, {
    conferenceId,
    conferenceName,
    roles,
  });

  const commandItems = buildCommandItemsFromNav({
    conferenceId,
    conferenceName,
    roles,
  });

  return (
    <header
      className={cn(
        'flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6',
        className,
      )}
    >
      {sidebarToggle}
      {mobileMenuButton}
      <div className="min-w-0 flex-1">
        <DashboardBreadcrumbs items={breadcrumbs} />
      </div>

      <div className="hidden flex-1 justify-center lg:flex">
        <CommandMenu items={commandItems} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <UserMenu />
      </div>
    </header>
  );
}
