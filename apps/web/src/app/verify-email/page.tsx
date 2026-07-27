'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { resolveReviewerInviteToken } from '@/lib/reviewer-invite-pending';
import { authorJoinPath, resolveAuthorJoinToken } from '@/lib/author-join-pending';
import { verifyEmailSchema, type VerifyEmailInput } from '@openconferences/schemas';
import { authClient } from '@/lib/auth-client';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const RESEND_COOLDOWN_SEC = 60;

function authRedirectQuery(reviewerInvite: string | null, authorJoin: string | null) {
  const params = new URLSearchParams();
  if (reviewerInvite) params.set('reviewerInvite', reviewerInvite);
  if (authorJoin) params.set('authorJoin', authorJoin);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const sent = searchParams.get('sent');
  const emailFromQuery = searchParams.get('email')?.trim() ?? '';
  const reviewerInvite = resolveReviewerInviteToken(searchParams.get('reviewerInvite'));
  const authorJoin = resolveAuthorJoinToken(searchParams.get('authorJoin'));
  const signInHref = authorJoin
    ? authorJoinPath(authorJoin)
    : `/sign-in${authRedirectQuery(reviewerInvite, null)}`;

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(
    sent ? 'We emailed a 6-digit verification code to your address.' : null,
  );
  const [verified, setVerified] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [sending, setSending] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { email: emailFromQuery, otp: '' },
  });

  useEffect(() => {
    if (!sent) return;
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
    return () => window.clearInterval(timer);
  }, [sent]);

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

  const onVerify = handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.emailOtp.verifyEmail({
      email: values.email,
      otp: values.otp,
    });

    if (result.error) {
      setError(result.error.message ?? 'Invalid or expired verification code');
      return;
    }

    setVerified(true);
    setMessage(null);
  });

  const onResend = async () => {
    const email = getValues('email')?.trim();
    if (!email) {
      setError('Enter your email to resend a code');
      return;
    }
    setSending(true);
    setError(null);
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'email-verification',
    });
    setSending(false);
    if (result.error) {
      setError(result.error.message ?? 'Unable to send verification code');
      return;
    }
    setMessage('If an account exists for that email, a verification code has been sent.');
    startResendCooldown();
  };

  return (
    <AuthShell
      title="Verify your email"
      description="Enter the 6-digit code we emailed you to confirm your address."
      footer={
        <>
          Ready to continue? <AuthLink href={signInHref}>Sign in</AuthLink>
        </>
      }
    >
      {verified ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-emerald-950">Email verified</h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-800">
            Your address is confirmed. Sign in to continue.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href={signInHref}>Continue to sign in</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onVerify}>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email ? (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="otp">Verification code</Label>
            <Input id="otp" inputMode="numeric" autoComplete="one-time-code" {...register('otp')} />
            {errors.otp ? <p className="text-sm text-destructive">{errors.otp.message}</p> : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying…' : 'Verify email'}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={sending || resendIn > 0}
            onClick={() => void onResend()}
          >
            {resendIn > 0 ? `Resend in ${resendIn}s` : sending ? 'Sending…' : 'Resend code'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
