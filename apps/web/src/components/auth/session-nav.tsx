'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';

export function SessionNav() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return <span className="text-sm text-muted-foreground">…</span>;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/sign-in" className="text-sm font-medium hover:underline">
          Sign in
        </Link>
        <Button asChild size="sm">
          <Link href="/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">{session.user.email}</span>
      <Button asChild variant="outline" size="sm">
        <Link href="/dashboard">Dashboard</Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={async () => {
          await signOut();
          router.refresh();
          router.push('/');
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
