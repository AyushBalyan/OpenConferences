'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptReviewerInvitation, declineReviewerInvitation } from '@/lib/api-client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { clearStoredReviewerInviteToken } from '@/lib/reviewer-invite-pending';

export default function ReviewerInviteAcceptPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
        <ReviewerInviteAccept />
      </Suspense>
    </ProtectedRoute>
  );
}

function ReviewerInviteAccept() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialToken = searchParams.get('token') ?? '';
  const autoAccept = searchParams.get('auto') === '1';
  const [token, setToken] = useState(initialToken);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoAttempted = useRef(false);

  function redirectAfterAccept(conferenceId: string) {
    router.replace(`/dashboard/conferences/${conferenceId}/reviews/bidding`);
    router.refresh();
  }

  async function completeAccept(invitationToken: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await acceptReviewerInvitation(invitationToken.trim());
      clearStoredReviewerInviteToken();
      setMessage(result.message);
      redirectAfterAccept(result.invitation.conferenceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    if (!token.trim()) return;
    await completeAccept(token);
  }

  async function handleDecline() {
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await declineReviewerInvitation(token.trim());
      setMessage(result.message);
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!autoAccept || !initialToken.trim() || autoAttempted.current) return;

    autoAttempted.current = true;
    void completeAccept(initialToken);
  }, [autoAccept, initialToken]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reviewer invitation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Accept or decline your invitation to join as a reviewer.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invitation</CardTitle>
          <CardDescription>You must be signed in with the invited email address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!autoAccept ? (
            <div className="space-y-2">
              <Label htmlFor="token">Token</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Invitation token"
              />
            </div>
          ) : busy && !message && !error ? (
            <p className="text-sm text-muted-foreground">Accepting invitation…</p>
          ) : null}
          {!autoAccept ? (
            <div className="flex gap-2">
              <Button onClick={handleAccept} disabled={busy || !token.trim()}>
                Accept
              </Button>
              <Button variant="outline" onClick={handleDecline} disabled={busy || !token.trim()}>
                Decline
              </Button>
            </div>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-green-600">{message}</p> : null}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
