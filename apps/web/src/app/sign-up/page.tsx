'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpInput } from '@openconferences/schemas';
import { authClient } from '@/lib/auth-client';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { TurnstileField } from '@/components/auth/turnstile-field';
import { isTurnstileEnabled, turnstileFetchOptions, withTurnstileBody } from '@/lib/turnstile';
import { resolveReviewerInviteToken } from '@/lib/reviewer-invite-pending';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TurnstileInstance } from '@marsidev/react-turnstile';

function reviewerInviteQuery(reviewerInvite: string | null) {
  return reviewerInvite ? `?reviewerInvite=${encodeURIComponent(reviewerInvite)}` : '';
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewerInvite = resolveReviewerInviteToken(searchParams.get('reviewerInvite'));
  const invitedEmail = searchParams.get('email');
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: invitedEmail ?? '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setMessage(null);

    if (isTurnstileEnabled && !turnstileToken) {
      setError('Please complete the verification check.');
      return;
    }

    const result = await authClient.signUp.email(
      withTurnstileBody(
        {
          email: values.email,
          password: values.password,
          name: values.name,
        },
        turnstileToken,
      ),
      turnstileFetchOptions(turnstileToken),
    );

    if (result.error) {
      if (result.error.status === 403) {
        setError('Human verification failed. Please try again.');
        setTurnstileToken(null);
        turnstileRef.current?.reset();
        return;
      }
      setError(result.error.message ?? 'Unable to create account');
      return;
    }

    setMessage('Account created. Check your email to verify your address before signing in.');
    const verifyParams = new URLSearchParams({ sent: '1' });
    if (reviewerInvite) {
      verifyParams.set('reviewerInvite', reviewerInvite);
    }
    router.push(`/verify-email?${verifyParams.toString()}`);
  });

  const signInHref = `/sign-in${reviewerInviteQuery(reviewerInvite)}`;

  return (
    <AuthShell
      title="Create your account"
      description={
        reviewerInvite
          ? 'Sign up with the invited email address to join as a reviewer.'
          : 'One global identity for every conference you join.'
      }
      footer={
        <>
          Already have an account? <AuthLink href={signInHref}>Sign in</AuthLink>
        </>
      }
    >
      {reviewerInvite ? (
        <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          You were invited to review. Use the same email address that received the invitation.
        </p>
      ) : null}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" autoComplete="name" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <TurnstileField widgetRef={turnstileRef} onTokenChange={setTurnstileToken} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Sign up'}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
      <SignUpContent />
    </Suspense>
  );
}
