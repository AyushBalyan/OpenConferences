'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  mfaEnrollSchema,
  mfaVerifySchema,
  type MfaEnrollInput,
  type MfaVerifyInput,
} from '@openconferences/schemas';
import { authClient, refreshSession } from '@/lib/auth-client';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const RESEND_COOLDOWN_SEC = 60;

function safeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

export default function MfaEnrollPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
        <MfaEnrollForm />
      </Suspense>
    </ProtectedRoute>
  );
}

function MfaEnrollForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next')) ?? '/me/dashboard';

  const [step, setStep] = useState<'password' | 'code' | 'done'>('password');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [sending, setSending] = useState(false);

  const passwordForm = useForm<MfaEnrollInput>({
    resolver: zodResolver(mfaEnrollSchema),
  });
  const codeForm = useForm<MfaVerifyInput>({
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
      return false;
    }
    startResendCooldown();
    return true;
  };

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    setError(null);
    const enableResult = await authClient.twoFactor.enable({
      password: values.password,
    });

    if (enableResult.error) {
      setError(enableResult.error.message ?? 'Unable to start MFA enrollment');
      return;
    }

    if (enableResult.data?.backupCodes?.length) {
      setBackupCodes(enableResult.data.backupCodes);
    }

    setStep('code');
    await sendOtp();
  });

  const onCodeSubmit = codeForm.handleSubmit(async (values) => {
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

    if (backupCodes.length > 0) {
      setStep('done');
      return;
    }

    router.push(nextPath);
  });

  return (
    <AuthShell
      title="Enable email verification"
      description="We will email a one-time code to confirm admin actions on your account."
    >
      {step === 'password' ? (
        <form className="space-y-4" onSubmit={onPasswordSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">Confirm password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...passwordForm.register('password')}
            />
            {passwordForm.formState.errors.password ? (
              <p className="text-sm text-destructive">
                {passwordForm.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            className="w-full"
            disabled={passwordForm.formState.isSubmitting || sending}
          >
            {passwordForm.formState.isSubmitting || sending ? 'Sending code…' : 'Email me a code'}
          </Button>
        </form>
      ) : null}

      {step === 'code' ? (
        <form className="space-y-4" onSubmit={onCodeSubmit}>
          <p className="text-sm text-muted-foreground">
            We emailed a 6-digit code to your address. Enter it below to finish enabling
            verification.
          </p>
          <div className="space-y-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              {...codeForm.register('code')}
            />
            {codeForm.formState.errors.code ? (
              <p className="text-sm text-destructive">{codeForm.formState.errors.code.message}</p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...codeForm.register('trustDevice')} />
            Trust this device
          </label>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={codeForm.formState.isSubmitting}>
            {codeForm.formState.isSubmitting ? 'Verifying…' : 'Verify and enable'}
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
      ) : null}

      {step === 'done' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Email verification is enabled. Save these backup codes in a safe place — each can be
            used once if you cannot receive email.
          </p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
            {backupCodes.map((code) => (
              <li key={code} className="rounded bg-muted px-2 py-1">
                {code}
              </li>
            ))}
          </ul>
          <Button asChild className="w-full">
            <Link href={nextPath}>Continue</Link>
          </Button>
        </div>
      ) : null}
    </AuthShell>
  );
}
