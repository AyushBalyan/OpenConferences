'use client';

import { usePathname } from 'next/navigation';
import { AppHeader } from '@/components/layout/app-header';

const HIDDEN_PREFIXES = [
  '/dashboard',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/mfa',
  '/reviewer-invite',
];

export function ConditionalAppHeader() {
  const pathname = usePathname();
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (hidden) return null;
  return <AppHeader />;
}
