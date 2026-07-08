'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { DashboardSidebar } from '@/components/dashboard/dashboard-sidebar';

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <DashboardShell sidebar={<DashboardSidebar />} mobileTitle="Home">
        {children}
      </DashboardShell>
    </ProtectedRoute>
  );
}
