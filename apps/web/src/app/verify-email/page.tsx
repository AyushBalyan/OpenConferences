'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { resolveReviewerInviteToken } from '@/lib/reviewer-invite-pending';
import { resendVerificationSchema, type ResendVerificationInput } from '@openconferences/schemas';
import { authClient } from '@/lib/auth-client';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const sent = searchParams.get('sent');
  const reviewerInvite = resolveReviewerInviteToken(searchParams.get('reviewerInvite'));
  const signInHref = reviewerInvite
    ? `/sign-in?reviewerInvite=${encodeURIComponent(reviewerInvite)}`
    : '/sign-in';
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(
    sent ? 'We sent a verification link to your email.' : null,
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResendVerificationInput>({
    resolver: zodResolver(resendVerificationSchema),
  });

  useEffect(() => {
    if (!token) return;

    setStatus('verifying');
    void authClient.verifyEmail({ query: { token } }).then((result) => {
      if (result.error) {
        setStatus('error');
        setMessage('Verification link is invalid or expired.');
      } else {
        setStatus('success');
        setMessage(null);
      }
    });
  }, [token]);

  const onResend = handleSubmit(async (values) => {
    setMessage(null);
    await authClient.sendVerificationEmail({
      email: values.email,
    });
    setMessage('If an account exists for that email, a verification link has been sent.');
  });

  return (
    <AuthShell
      title="Verify your email"
      description="Confirm your address to submit papers and accept reviewer invitations."
      footer={
        <>
          Ready to continue? <AuthLink href={signInHref}>Sign in</AuthLink>
        </>
      }
    >
      {status === 'success' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-emerald-950">Email verified</h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-800">
            Your address is confirmed. You can sign in and accept reviewer invitations.
          </p>
          <Button asChild className="mt-6 w-full">
            <Link href={signInHref}>Continue to sign in</Link>
          </Button>
        </div>
      ) : status === 'verifying' ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="size-8 animate-spin text-indigo-600" aria-hidden />
          <p className="text-sm font-medium text-slate-700">Verifying your email…</p>
        </div>
      ) : (
        <>
          {status === 'error' && message ? (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4" role="alert">
              <XCircle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
              <p className="text-sm text-red-800">{message}</p>
            </div>
          ) : message ? (
            <p className="text-sm text-muted-foreground">{message}</p>
          ) : null}
          <form className="space-y-4" onSubmit={onResend}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register('email')} />
              {errors.email ? (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <Button type="submit" variant="outline" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Resend verification email'}
            </Button>
          </form>
        </>
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
