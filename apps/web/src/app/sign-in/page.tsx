'use client';

import { Suspense, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInInput } from '@openconferences/schemas';
import { authClient, refreshSession } from '@/lib/auth-client';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { TurnstileField } from '@/components/auth/turnstile-field';
import { isTurnstileEnabled, turnstileFetchOptions, withTurnstileBody } from '@/lib/turnstile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  clearStoredReviewerInviteToken,
  resolveReviewerInviteToken,
} from '@/lib/reviewer-invite-pending';
import { authorJoinPath, resolveAuthorJoinToken } from '@/lib/author-join-pending';
import { acceptPendingReviewerInvitations } from '@/lib/api-client';
import type { TurnstileInstance } from '@marsidev/react-turnstile';

function authRedirectQuery(reviewerInvite: string | null, authorJoin: string | null) {
  const params = new URLSearchParams();
  if (reviewerInvite) params.set('reviewerInvite', reviewerInvite);
  if (authorJoin) params.set('authorJoin', authorJoin);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewerInvite = resolveReviewerInviteToken(searchParams.get('reviewerInvite'));
  const authorJoin = resolveAuthorJoinToken(searchParams.get('authorJoin'));
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);

    if (isTurnstileEnabled && !turnstileToken) {
      setError('Please complete the verification check.');
      return;
    }

    const result = await authClient.signIn.email(
      withTurnstileBody(
        {
          email: values.email,
          password: values.password,
          rememberMe: values.rememberMe ?? false,
        },
        turnstileToken,
      ),
      turnstileFetchOptions(turnstileToken),
    );

    if (result.error) {
      if (result.error.status === 403) {
        const message = result.error.message ?? '';
        if (message.includes('Human verification')) {
          setError('Human verification failed. Please try again.');
          setTurnstileToken(null);
          turnstileRef.current?.reset();
          return;
        }
        setError('Please verify your email address before signing in.');
        return;
      }
      setError('Invalid email or password');
      return;
    }

    if ('twoFactorRedirect' in result.data && result.data.twoFactorRedirect) {
      router.push(`/mfa/challenge${authRedirectQuery(reviewerInvite, authorJoin)}`);
      return;
    }

    // Better Auth refreshes the session atom on a short delay after sign-in;
    // wait for the cookie-backed session before navigating into protected routes.
    await refreshSession();

    if (authorJoin) {
      router.push(authorJoinPath(authorJoin));
      return;
    }

    try {
      const pending = await acceptPendingReviewerInvitations();
      if (pending.data.length > 0) {
        clearStoredReviewerInviteToken();
        router.push(`/dashboard/conferences/${pending.data[0]!.conferenceId}/reviews/bidding`);
        return;
      }
    } catch {
      // Fall through to token-based accept or dashboard.
    }

    if (reviewerInvite) {
      router.push(`/reviewer-invite/accept?token=${encodeURIComponent(reviewerInvite)}&auto=1`);
      return;
    }

    clearStoredReviewerInviteToken();
    router.push('/me/dashboard');
  });

  const signUpHref = `/sign-up${authRedirectQuery(reviewerInvite, authorJoin)}`;

  return (
    <AuthShell
      title="Welcome back"
      description={
        authorJoin
          ? 'Sign in to submit your paper to this conference.'
          : reviewerInvite
            ? 'Sign in with the invited email address to accept your reviewer invitation.'
            : 'Sign in to manage submissions, reviews, and conferences.'
      }
      footer={
        <>
          Need an account? <AuthLink href={signUpHref}>Sign up</AuthLink>
        </>
      }
    >
      {authorJoin ? (
        <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          You opened a conference submit link. Sign in or create an account to continue.
        </p>
      ) : reviewerInvite ? (
        <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          You have a pending reviewer invitation. Sign in to accept it.
        </p>
      ) : null}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email">{authorJoin ? 'Corresponding author email' : 'Email'}</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <AuthLink href="/forgot-password">Forgot password?</AuthLink>
          </div>
          <PasswordInput id="password" autoComplete="current-password" {...register('password')} />
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('rememberMe')} />
          Remember me
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <TurnstileField widgetRef={turnstileRef} onTokenChange={setTurnstileToken} />
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
      <SignInContent />
    </Suspense>
  );
}
