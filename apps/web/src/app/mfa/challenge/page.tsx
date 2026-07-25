'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
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

const RESEND_COOLDOWN_SEC = 60;

function MfaChallengeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authorJoin = resolveAuthorJoinToken(searchParams.get('authorJoin'));
  const reviewerInvite = resolveReviewerInviteToken(searchParams.get('reviewerInvite'));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [sending, setSending] = useState(false);
  const autoSent = useRef(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaVerifyInput>({
    resolver: zodResolver(mfaVerifySchema),
    defaultValues: { trustDevice: false },
  });

  const startResendCooldown = () => {
    setResendIn(RESEND_COOLDOWN_SEC);
    const timer = window.setInterval(() => {
      setResendIn((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    setSending(true);
    setError(null);
    const result = await authClient.twoFactor.sendOtp({});
    setSending(false);
    if (result.error) {
      setError(result.error.message ?? 'Unable to send verification code');
      setStatus(null);
      return;
    }
    setStatus('We emailed a code to your address.');
    startResendCooldown();
  };

  useEffect(() => {
    if (autoSent.current) return;
    autoSent.current = true;
    void sendOtp();
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.twoFactor.verifyOtp({
      code: values.code,
      trustDevice: values.trustDevice ?? false,
    });

    if (result.error) {
      setError('Invalid or expired verification code');
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
      title="Check your email"
      description="Enter the 6-digit code we sent to finish signing in."
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
        <div className="space-y-2">
          <Label htmlFor="code">Verification code</Label>
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
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={sending || resendIn > 0}
          onClick={() => void sendOtp()}
        >
          {resendIn > 0 ? `Resend in ${resendIn}s` : sending ? 'Sending…' : 'Resend code'}
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
