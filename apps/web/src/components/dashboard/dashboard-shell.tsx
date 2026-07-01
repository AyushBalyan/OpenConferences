'use client';

import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar';
import { cn } from '@/lib/utils';

type DashboardShellProps = {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  mobileTitle?: string;
  conferenceId?: string;
  conferenceName?: string;
  roles?: string[];
  topbarActions?: React.ReactNode;
};

export function DashboardShell({
  sidebar,
  children,
  mobileTitle = 'Dashboard',
  conferenceId,
  conferenceName,
  roles,
  topbarActions,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const mobileMenuButton = (
    <Button
      variant="outline"
      size="sm"
      className="h-9 w-9 shrink-0 p-0 lg:hidden"
      onClick={() => setMobileOpen(true)}
      aria-label="Open navigation"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50">
      <aside className="hidden h-dvh w-[250px] shrink-0 border-r border-slate-200 bg-white lg:block">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[280px] max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <span className="truncate text-sm font-medium text-slate-900">{mobileTitle}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">{sidebar}</div>
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopbar
          conferenceId={conferenceId}
          conferenceName={conferenceName}
          roles={roles}
          actions={topbarActions}
          mobileMenuButton={mobileMenuButton}
        />

        <main className={cn('min-h-0 flex-1 overflow-y-auto')}>
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
