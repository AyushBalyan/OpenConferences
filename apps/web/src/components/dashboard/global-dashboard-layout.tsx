'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';

type GlobalDashboardLayoutProps = {
  children: React.ReactNode;
  mobileTitle?: string;
};

export function GlobalDashboardLayout({
  children,
  mobileTitle = 'Dashboard',
}: GlobalDashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <DashboardShell sidebar={<DashboardSidebar />} mobileTitle={mobileTitle}>
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}
