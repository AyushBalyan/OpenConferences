'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpInput } from '@openconferences/schemas';
import { authClient } from '@/lib/auth-client';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { TurnstileField } from '@/components/auth/turnstile-field';
import { isTurnstileEnabled, turnstileFetchOptions, withTurnstileBody } from '@/lib/turnstile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { TurnstileInstance } from '@marsidev/react-turnstile';

export default function SignUpPage() {
  const router = useRouter();
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
    router.push('/verify-email?sent=1');
  });

  return (
    <AuthShell
      title="Create your account"
      description="One global identity for every conference you join."
      footer={
        <>
          Already have an account? <AuthLink href="/sign-in">Sign in</AuthLink>
        </>
      }
    >
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
