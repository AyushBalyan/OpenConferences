'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { mfaVerifySchema, type MfaVerifyInput } from '@openconferences/schemas';
import { authClient, refreshSession } from '@/lib/auth-client';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authorJoinPath, resolveAuthorJoinToken } from '@/lib/author-join-pending';
import { resolveReviewerInviteToken } from '@/lib/reviewer-invite-pending';

function MfaChallengeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authorJoin = resolveAuthorJoinToken(searchParams.get('authorJoin'));
  const reviewerInvite = resolveReviewerInviteToken(searchParams.get('reviewerInvite'));
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaVerifyInput>({
    resolver: zodResolver(mfaVerifySchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.twoFactor.verifyTotp({
      code: values.code,
      trustDevice: values.trustDevice ?? false,
    });

    if (result.error) {
      setError('Invalid verification code');
      return;
    }

    await refreshSession();

    router.push(
      authorJoin
        ? authorJoinPath(authorJoin)
        : reviewerInvite
          ? `/reviewer-invite/accept?token=${encodeURIComponent(reviewerInvite)}&auto=1`
          : '/me/dashboard',
    );
  });

  return (
    <AuthShell
      title="Two-factor verification"
      description="Enter the 6-digit code from your authenticator app."
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="code">Authentication code</Label>
          <Input id="code" inputMode="numeric" autoComplete="one-time-code" {...register('code')} />
          {errors.code ? <p className="text-sm text-destructive">{errors.code.message}</p> : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('trustDevice')} />
          Trust this device
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Verifying…' : 'Verify'}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function MfaChallengePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
      <MfaChallengeContent />
    </Suspense>
  );
}
