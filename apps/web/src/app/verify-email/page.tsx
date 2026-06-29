'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
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

  if (token && status === 'idle') {
    void authClient.verifyEmail({ query: { token } }).then((result) => {
      if (result.error) {
        setStatus('error');
        setMessage('Verification link is invalid or expired.');
      } else {
        setStatus('success');
        setMessage('Email verified. You can now sign in.');
      }
    });
  }

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
          Ready to continue? <AuthLink href="/sign-in">Sign in</AuthLink>
        </>
      }
    >
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      <form className="space-y-4" onSubmit={onResend}>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email ? <p className="text-sm text-destructive">{errors.email.message}</p> : null}
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Resend verification email'}
        </Button>
      </form>
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
