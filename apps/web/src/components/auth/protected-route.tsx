'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth-client';

type ProtectedRouteProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
};

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
