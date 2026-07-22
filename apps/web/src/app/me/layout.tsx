'use client';

import { GlobalDashboardLayout } from '@/components/dashboard/global-dashboard-layout';

export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <GlobalDashboardLayout mobileTitle="Home">{children}</GlobalDashboardLayout>;
}
