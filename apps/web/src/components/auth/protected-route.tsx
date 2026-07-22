'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

type ProtectedRouteProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
};

/**
 * Client-side auth gate. Better Auth's session atom can briefly report
 * `isPending: false` with `data: null` after sign-in (delayed refresh) or
 * React Strict Mode abort — always confirm with a fresh refetch before redirecting.
 */
export function ProtectedRoute({
  children,
  fallback,
  redirectTo = '/sign-in',
}: ProtectedRouteProps) {
  const router = useRouter();
  const { data: session, isPending, refetch } = useSession();
  const [freshCheckDone, setFreshCheckDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      if (isPending) return;

      if (session) {
        setFreshCheckDone(true);
        return;
      }

      if (!freshCheckDone) {
        await refetch();
        if (cancelled) return;
        setFreshCheckDone(true);
        return;
      }

      router.replace(redirectTo);
    }

    void verifySession();
    return () => {
      cancelled = true;
    };
  }, [isPending, session, freshCheckDone, refetch, router, redirectTo]);

  if (isPending || (!session && !freshCheckDone)) {
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
