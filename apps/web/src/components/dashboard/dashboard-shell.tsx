'use client';

import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DashboardTopbar } from '@/components/dashboard/dashboard-topbar';
import { SidebarProvider, useSidebar } from '@/components/dashboard/sidebar-context';
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

function DashboardShellInner({
  sidebar,
  children,
  mobileTitle = 'Dashboard',
  conferenceId,
  conferenceName,
  roles,
  topbarActions,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggleCollapsed } = useSidebar();
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    mobileCloseRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !mobilePanelRef.current) return;

      const focusable = mobilePanelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), select, textarea, input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

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
    <div className="fixed inset-0 flex h-dvh w-full overflow-hidden bg-slate-50">
      <aside
        className={cn(
          'hidden h-full min-h-0 shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 lg:block',
          collapsed ? 'w-16' : 'w-[250px]',
        )}
      >
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
          <aside
            ref={mobilePanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="relative flex h-full w-[280px] max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl"
          >
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <span className="truncate text-sm font-medium text-slate-900">{mobileTitle}</span>
              <Button
                ref={mobileCloseRef}
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
          sidebarToggle={
            <Button
              variant="ghost"
              size="sm"
              className="hidden h-9 w-9 p-0 lg:inline-flex"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-5 w-5" />
              ) : (
                <PanelLeftClose className="h-5 w-5" />
              )}
            </Button>
          }
        />

        <main className="min-h-0 min-w-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto">
          <div className="mx-auto w-full min-w-0 max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <SidebarProvider>
      <DashboardShellInner {...props} />
    </SidebarProvider>
  );
}
