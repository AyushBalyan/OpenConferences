'use client';
import { useEffect, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
type Result = { state: string; conferenceName: string | null; confirmed?: boolean };
const messages: Record<string, string> = {
  ACCEPTED:
    'This invitation has already been accepted. Please contact the organizers if your availability has changed.',
  DECLINED: 'This invitation has already been declined. No further action is needed.',
  EXPIRED:
    'This invitation has expired. Please contact the organizers if you would still like to participate.',
  REVOKED: 'This invitation is no longer available. No further action is needed.',
  INVALID:
    'This invitation link is invalid or has been replaced. Please use the latest link from your invitation email.',
};
async function request(invitationToken: string, confirm: boolean, reason = '') {
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
  const response = await fetch(
    `${api}/reviewer-invitations/public/${confirm ? 'decline' : 'status'}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      cache: 'no-store',
      body: JSON.stringify({
        token: invitationToken,
        ...(confirm ? { reason: reason.trim() || undefined } : {}),
      }),
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? 'Too many attempts. Please wait a minute and try again.'
        : 'The invitation could not be checked. Please try again.',
    );
  return response.json() as Promise<Result>;
}
export default function DeclineInvitationPage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let active = true;
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    setToken(value);
    if (!value) {
      setResult({ state: 'INVALID', conferenceName: null });
      return;
    }
    void request(value, false)
      .then((data) => {
        if (active) setResult(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const canDecline = result && ['PENDING', 'SENT'].includes(result.state);
  async function confirm() {
    if (!token || busy) return;
    setBusy(true);
    setError('');
    try {
      setResult(await request(token, true, reason));
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell
      headingLevel="h1"
      title={
        result?.confirmed
          ? 'Thank you for your time'
          : paused
            ? 'Your invitation is unchanged'
            : canDecline
              ? 'Decline reviewer invitation?'
              : 'Reviewer invitation'
      }
      description={
        result?.confirmed
          ? 'Your invitation has been declined. No further action is needed.'
          : result?.conferenceName
            ? `Invitation to review for ${result.conferenceName}.`
            : 'Respond securely to your personal invitation.'
      }
    >
      <div className="space-y-5">
        {!result && !error && (
          <p role="status" className="text-sm text-slate-600">
            Checking your invitation…
          </p>
        )}
        {paused ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              You have not declined. You can return to your invitation email and accept or decline
              later, before it expires.
            </p>
            <Button variant="outline" onClick={() => setPaused(false)}>
              Return to confirmation
            </Button>
          </div>
        ) : canDecline ? (
          <form
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              void confirm();
            }}
          >
            <p className="text-sm leading-6 text-slate-700">
              Are you sure you want to decline this invitation? Your response will be available to
              the organizers.
            </p>
            <div className="space-y-2">
              <Label htmlFor="decline-reason">Reason (optional)</Label>
              <textarea
                id="decline-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                rows={4}
                className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700"
              />
              <p className="text-xs text-slate-600">
                Shared only with authorized organizers. You can leave this blank.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                disabled={busy}
                className="min-h-11 bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-700"
              >
                {busy ? 'Confirming…' : 'Confirm decline'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setPaused(true)}
              >
                Go back
              </Button>
            </div>
          </form>
        ) : result && !result.confirmed ? (
          <p role="status" className="text-sm leading-6 text-slate-700">
            {messages[result.state] ?? messages.INVALID}
          </p>
        ) : null}
        {error && (
          <div role="alert" className="space-y-3">
            <p className="text-sm text-rose-700">{error}</p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  setResult(await request(token, false));
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Please try again.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
