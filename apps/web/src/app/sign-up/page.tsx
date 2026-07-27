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
import { resolveAuthorJoinToken, storeAuthorAffiliation } from '@/lib/author-join-pending';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TurnstileInstance } from '@marsidev/react-turnstile';

function authRedirectQuery(reviewerInvite: string | null, authorJoin: string | null) {
  const params = new URLSearchParams();
  if (reviewerInvite) params.set('reviewerInvite', reviewerInvite);
  if (authorJoin) params.set('authorJoin', authorJoin);
  const query = params.toString();
  return query ? `?${query}` : '';
}

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewerInvite = resolveReviewerInviteToken(searchParams.get('reviewerInvite'));
  const authorJoin = resolveAuthorJoinToken(searchParams.get('authorJoin'));
  const invitedEmail = searchParams.get('email');
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [affiliation, setAffiliation] = useState('');
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

    if (authorJoin) {
      storeAuthorAffiliation(affiliation);
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

    setMessage('Account created. Check your email for a verification code before signing in.');
    const verifyParams = new URLSearchParams({ sent: '1', email: values.email });
    if (reviewerInvite) {
      verifyParams.set('reviewerInvite', reviewerInvite);
    }
    if (authorJoin) {
      verifyParams.set('authorJoin', authorJoin);
    }
    router.push(`/verify-email?${verifyParams.toString()}`);
  });

  const signInHref = `/sign-in${authRedirectQuery(reviewerInvite, authorJoin)}`;

  return (
    <AuthShell
      title="Create your account"
      description={
        authorJoin
          ? 'Create an account to submit your paper to this conference.'
          : reviewerInvite
            ? 'Sign up with the invited email address to join as a reviewer.'
            : 'One global identity for every conference you join.'
      }
      footer={
        <>
          Already have an account? <AuthLink href={signInHref}>Sign in</AuthLink>
        </>
      }
    >
      {authorJoin ? (
        <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          You opened a conference submit link. Use your email to create an account, then verify it
          before submitting.
        </p>
      ) : reviewerInvite ? (
        <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          You were invited to review. Use the same email address that received the invitation.
        </p>
      ) : null}
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-2">
          <Label htmlFor="name">{authorJoin ? 'Corresponding author name' : 'Full name'}</Label>
          <Input id="name" autoComplete="name" {...register('name')} />
          {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{authorJoin ? 'Corresponding author email' : 'Email'}</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
        {authorJoin ? (
          <div className="space-y-2">
            <Label htmlFor="affiliation">Affiliation</Label>
            <Input
              id="affiliation"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="University or organization"
              autoComplete="organization"
            />
            <p className="text-xs text-muted-foreground">
              Used as your corresponding-author affiliation on submissions.
            </p>
          </div>
        ) : null}
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
