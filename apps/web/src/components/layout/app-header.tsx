'use client';

import Link from 'next/link';
import { SessionNav } from '@/components/auth/session-nav';

export function AppHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          OpenConferences
        </Link>
        <SessionNav />
      </div>
    </header>
  );
}
