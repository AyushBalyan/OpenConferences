'use client';

import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';

function isConferenceWorkspaceRoute(pathname: string): boolean {
  // Conference workspace pages supply their own shell; exclude /conferences/new.
  return /^\/dashboard\/conferences\/(?!new(?:\/|$))[^/]+/.test(pathname);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const usesConferenceShell = isConferenceWorkspaceRoute(pathname);

  return (
    <ProtectedRoute>
      {usesConferenceShell ? (
        children
      ) : (
        <DashboardShell sidebar={<DashboardSidebar />} mobileTitle="Dashboard">
          {children}
        </DashboardShell>
      )}
    </ProtectedRoute>
  );
}
