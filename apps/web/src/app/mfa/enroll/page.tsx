'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { mfaEnrollSchema, type MfaEnrollInput } from '@openconferences/schemas';
import { authClient } from '@/lib/auth-client';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AuthShell } from '@/components/auth/auth-shell';
import { TotpQrCode } from '@/components/auth/totp-qr-code';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function MfaEnrollPage() {
  return (
    <ProtectedRoute>
      <MfaEnrollForm />
    </ProtectedRoute>
  );
}

function MfaEnrollForm() {
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaEnrollInput>({
    resolver: zodResolver(mfaEnrollSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await authClient.twoFactor.enable({
      password: values.password,
    });

    if (result.error) {
      setError(result.error.message ?? 'Unable to start MFA enrollment');
      return;
    }

    if (result.data) {
      setTotpUri(result.data.totpURI);
      setBackupCodes(result.data.backupCodes);
    }
  });

  return (
    <AuthShell
      title="Enable two-factor authentication"
      description="Protect privileged organizer actions with a TOTP authenticator app."
    >
      {!totpUri ? (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="password">Confirm password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password ? (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            ) : null}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Generating…' : 'Generate authenticator setup'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password,
            etc.), then verify a code on the next page.
          </p>
          <TotpQrCode uri={totpUri} />
          <div>
            <p className="mb-2 text-sm font-medium">Backup codes</p>
            <ul className="grid grid-cols-2 gap-2 text-sm font-mono">
              {backupCodes.map((code) => (
                <li key={code} className="rounded bg-muted px-2 py-1">
                  {code}
                </li>
              ))}
            </ul>
          </div>
          <Button asChild className="w-full">
            <Link href="/mfa/challenge">Verify setup</Link>
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
