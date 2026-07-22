'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { joinAsAuthor } from '@/lib/api-client';
import {
  authorJoinPath,
  authorJoinQuery,
  clearStoredAuthorJoinToken,
  resolveAuthorJoinToken,
} from '@/lib/author-join-pending';
import { useSession } from '@/lib/auth-client';

function AuthorJoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = resolveAuthorJoinToken(searchParams.get('token'));
  const { data: session, isPending } = useSession();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token) {
      setError('This submit link is invalid or incomplete.');
      return;
    }

    if (isPending) return;

    if (!session) {
      router.replace(`/sign-in${authorJoinQuery(token)}`);
      return;
    }

    if (attempted.current) return;
    attempted.current = true;

    joinAsAuthor(token)
      .then((result) => {
        clearStoredAuthorJoinToken();
        router.replace(`/dashboard/conferences/${result.conferenceId}/submissions/new`);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Unable to join as author');
      });
  }, [isPending, router, session, token]);

  const signInHref = token ? `/sign-in${authorJoinQuery(token)}` : '/sign-in';

  return (
    <AuthShell
      title="Join as author"
      description="Setting up your author access and opening the submission form."
      footer={
        <>
          Need help? <AuthLink href={signInHref}>Sign in manually</AuthLink>
        </>
      }
    >
      {!error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-8 animate-spin text-indigo-600" aria-hidden />
          <p className="text-sm font-medium text-slate-700">Preparing your submission workspace…</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          {token ? (
            <Button asChild variant="outline" className="w-full">
              <Link href={authorJoinPath(token)}>Try again</Link>
            </Button>
          ) : null}
        </div>
      )}
    </AuthShell>
  );
}

export default function AuthorJoinPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
      <AuthorJoinContent />
    </Suspense>
  );
}
