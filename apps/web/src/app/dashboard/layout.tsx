'use client';

import { usePathname } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { GlobalDashboardLayout } from '@/components/dashboard/global-dashboard-layout';

function isConferenceWorkspaceRoute(pathname: string): boolean {
  return /^\/dashboard\/conferences\/(?!new(?:\/|$))[^/]+/.test(pathname);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const usesConferenceShell = isConferenceWorkspaceRoute(pathname);

  if (usesConferenceShell) {
    return <ProtectedRoute>{children}</ProtectedRoute>;
  }

  return <GlobalDashboardLayout mobileTitle="Dashboard">{children}</GlobalDashboardLayout>;
}
