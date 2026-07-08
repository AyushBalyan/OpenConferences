'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';

function ReviewerJoinErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <AuthShell
      title="Invitation link expired"
      description="We could not sign you in with this link."
      footer={
        <>
          Have an account? <AuthLink href="/sign-in">Sign in</AuthLink>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This sign-in link may have expired or already been used. Magic links are valid for 24
          hours. Ask the conference organizer to send a new reviewer invitation.
        </p>
        {error ? (
          <p className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            {error}
          </p>
        ) : null}
        <Button asChild className="w-full">
          <Link href="/sign-in">Go to sign in</Link>
        </Button>
      </div>
    </AuthShell>
  );
}

export default function ReviewerJoinErrorPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
      <ReviewerJoinErrorContent />
    </Suspense>
  );
}
