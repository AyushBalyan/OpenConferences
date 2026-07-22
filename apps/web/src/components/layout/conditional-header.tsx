'use client';

import { usePathname } from 'next/navigation';
import { AppHeader } from '@/components/layout/app-header';

const HIDDEN_PREFIXES = [
  '/dashboard',
  '/me',
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/mfa',
  '/reviewer-invite',
  '/join',
];

export function ConditionalAppHeader() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (hidden) return null;
  return <AppHeader />;
}
