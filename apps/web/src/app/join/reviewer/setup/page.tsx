'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { accountSetupSchema, type AccountSetupInput } from '@openconferences/schemas';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AuthShell, AuthLink } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchMe, setupAccount } from '@/lib/api-client';

export default function ReviewerJoinSetupPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
        <ReviewerJoinSetup />
      </Suspense>
    </ProtectedRoute>
  );
}

function ReviewerJoinSetup() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conferenceId = searchParams.get('conferenceId');
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [defaultName, setDefaultName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const profile = await fetchMe();
      if (!profile) {
        setError('Unable to load your account.');
        setLoading(false);
        return;
      }

      if (!profile.needsProfileSetup) {
        if (conferenceId) {
          router.replace(`/dashboard/conferences/${conferenceId}/reviews/bidding`);
        } else {
          router.replace('/dashboard');
        }
        return;
      }

      const localPart = profile.email.split('@')[0]?.trim().toLowerCase() ?? '';
      const nameLooksPlaceholder =
        profile.name.trim().toLowerCase() === localPart && localPart.length > 0;
      setDefaultName(nameLooksPlaceholder ? '' : profile.name);
      setNeedsSetup(true);
      setLoading(false);
    })();
  }, [conferenceId, router]);

  const redirectTarget = conferenceId
    ? `/dashboard/conferences/${conferenceId}/reviews/bidding`
    : '/dashboard';

  return (
    <AuthShell
      title="Finish setting up your account"
      description="Choose your display name and a password so you can sign in again later."
      footer={
        <>
          Skip for now? <AuthLink href={redirectTarget}>Go to dashboard</AuthLink>
        </>
      }
    >
      {loading ? <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p> : null}

      {needsSetup ? (
        <ProfileSetupForm
          defaultName={defaultName}
          redirectTarget={redirectTarget}
          onError={setError}
        />
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </AuthShell>
  );
}

function ProfileSetupForm({
  defaultName,
  redirectTarget,
  onError,
}: {
  defaultName: string;
  redirectTarget: string;
  onError: (message: string | null) => void;
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountSetupInput>({
    resolver: zodResolver(accountSetupSchema),
    defaultValues: {
      name: defaultName,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    onError(null);

    try {
      await setupAccount(values);
      router.replace(redirectTarget);
      router.refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save account details');
    }
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" autoComplete="name" {...register('name')} />
        {errors.name ? <p className="text-sm text-destructive">{errors.name.message}</p> : null}
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
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword ? (
          <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
        ) : null}
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save and continue'}
      </Button>
      <Button asChild variant="outline" className="w-full">
        <Link href={redirectTarget}>Skip for now</Link>
      </Button>
    </form>
  );
}
