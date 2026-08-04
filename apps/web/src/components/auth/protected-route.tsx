'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

type ProtectedRouteProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
};

/**
 * Client-side auth gate.
 *
 * Trust Better Auth's session atom only — do not call `refetch()` from an effect
 * that depends on `isPending`. `refetch()` sets `isPending: true` when session
 * data is null, which re-enters the effect and can storm `/get-session`.
 */
export function ProtectedRoute({
  children,
  fallback,
  redirectTo = '/sign-in',
}: ProtectedRouteProps) {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace(redirectTo);
    }
  }, [isPending, session, router, redirectTo]);

  if (isPending) {
    return (
      fallback ?? (
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading session…
        </div>
      )
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
