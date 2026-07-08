'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { acceptReviewerInvitation, fetchMe } from '@/lib/api-client';

export default function ReviewerJoinCompletePage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
        <ReviewerJoinComplete />
      </Suspense>
    </ProtectedRoute>
  );
}

function ReviewerJoinComplete() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('invitationToken') ?? '';
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!invitationToken.trim()) {
      setError('This invitation link is missing a token. Please use the link from your email.');
      return;
    }

    if (attempted.current) {
      return;
    }
    attempted.current = true;

    void (async () => {
      try {
        const result = await acceptReviewerInvitation(invitationToken.trim());
        const conferenceId = result.invitation.conferenceId;
        const profile = await fetchMe();

        if (profile?.needsProfileSetup) {
          router.replace(`/join/reviewer/setup?conferenceId=${encodeURIComponent(conferenceId)}`);
          return;
        }

        router.replace(`/dashboard/conferences/${conferenceId}/reviews/bidding`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to accept invitation');
      }
    })();
  }, [invitationToken, router]);

  const fallbackHref = invitationToken
    ? `/sign-in?reviewerInvite=${encodeURIComponent(invitationToken)}`
    : '/sign-in';

  return (
    <AuthShell
      title="Joining review committee"
      description="Setting up your reviewer access."
      footer={
        <>
          Need help? <AuthLink href={fallbackHref}>Sign in manually</AuthLink>
        </>
      }
    >
      {!error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-8 animate-spin text-indigo-600" aria-hidden />
          <p className="text-sm font-medium text-slate-700">Joining review committee…</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href={fallbackHref}>Continue with sign in</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
