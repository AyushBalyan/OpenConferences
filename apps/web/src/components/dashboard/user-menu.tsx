'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { signOut, useSession } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function initialsFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function UserMenu() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  if (!session) return null;

  const email = session.user.email ?? 'User';
  const initials = initialsFromEmail(email);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Open user menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 ring-2 ring-white transition hover:bg-indigo-200"
      >
        {initials}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-medium text-slate-900">{email}</p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <User className="h-4 w-4 text-slate-400" />
            Dashboard
          </Link>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            onClick={async () => {
              setOpen(false);
              await signOut();
              router.refresh();
              router.push('/');
            }}
          >
            <LogOut className="h-4 w-4 text-slate-400" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function SidebarUserSummary({ className }: { className?: string }) {
  const { data: session } = useSession();

  if (!session) return null;

  const email = session.user.email ?? 'Signed in';

  return (
    <div className={cn('rounded-lg border border-slate-200 bg-white p-3', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Signed in as</p>
      <p className="mt-1 truncate text-sm font-medium text-slate-900">{email}</p>
      <Button asChild variant="ghost" size="sm" className="mt-2 h-8 w-full justify-start px-2">
        <Link href="/dashboard">
          <ChevronDown className="mr-1 h-4 w-4 rotate-[-90deg]" />
          Switch conference
        </Link>
      </Button>
    </div>
  );
}
