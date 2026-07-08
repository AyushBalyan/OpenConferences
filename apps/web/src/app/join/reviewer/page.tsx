'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';

const apiOrigin =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ?? 'http://localhost:3001';

function buildMagicLinkVerifyUrl(
  magicToken: string,
  invitationToken: string,
  webOrigin: string,
): string {
  const callbackURL = new URL('/join/reviewer/complete', webOrigin);
  callbackURL.searchParams.set('invitationToken', invitationToken);

  const errorCallbackURL = new URL('/join/reviewer/error', webOrigin);

  const verifyUrl = new URL('/api/v1/auth/magic-link/verify', apiOrigin);
  verifyUrl.searchParams.set('token', magicToken);
  verifyUrl.searchParams.set('callbackURL', callbackURL.toString());
  verifyUrl.searchParams.set('errorCallbackURL', errorCallbackURL.toString());

  return verifyUrl.toString();
}

function ReviewerJoinContent() {
  const searchParams = useSearchParams();
  const magicToken = searchParams.get('token') ?? '';
  const invitationToken = searchParams.get('invitationToken') ?? '';
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!magicToken.trim() || !invitationToken.trim()) {
      setError(
        'This invitation link is invalid or incomplete. Please use the link from your email.',
      );
      return;
    }

    if (attempted.current) {
      return;
    }
    attempted.current = true;

    window.location.href = buildMagicLinkVerifyUrl(
      magicToken.trim(),
      invitationToken.trim(),
      window.location.origin,
    );
  }, [magicToken, invitationToken]);

  const fallbackHref = invitationToken
    ? `/sign-in?reviewerInvite=${encodeURIComponent(invitationToken)}`
    : '/sign-in';

  return (
    <AuthShell
      title="Join as reviewer"
      description="Confirming your invitation and signing you in securely."
      footer={
        <>
          Need help? <AuthLink href={fallbackHref}>Sign in manually</AuthLink>
        </>
      }
    >
      {!error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-8 animate-spin text-indigo-600" aria-hidden />
          <p className="text-sm font-medium text-slate-700">Opening your reviewer invitation…</p>
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

export default function ReviewerJoinPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
      <ReviewerJoinContent />
    </Suspense>
  );
}
