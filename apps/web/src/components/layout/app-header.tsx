'use client';

import Link from 'next/link';
import { SessionNav } from '@/components/auth/session-nav';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          FresiCMT
        </Link>
        <SessionNav />
      </div>
    </header>
  );
}
