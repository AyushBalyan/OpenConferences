'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  completeStudentDocUpload,
  createRegistration,
  fetchRegistration,
  initiatePayment,
  initiateStudentDocUpload,
} from '@/lib/api-client';
import type { RegistrationDetailDto } from '@openconferences/schemas';
import { useCallback, useEffect, useState } from 'react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

type RegistrationCardProps = {
  conferenceId: string;
  paperId: string;
};

function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

export function RegistrationCard({ conferenceId, paperId }: RegistrationCardProps) {
  const [registration, setRegistration] = useState<RegistrationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<'REGULAR' | 'STUDENT'>('REGULAR');

  const load = useCallback(async () => {
    try {
      const data = await fetchRegistration(conferenceId, paperId);
      setRegistration(data);
      if (data.audience) setAudience(data.audience);
      setError(null);
    } catch {
      setRegistration(null);
    } finally {
      setLoading(false);
    }
  }, [conferenceId, paperId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onChooseAudience() {
    setBusy(true);
    setError(null);
    try {
      await createRegistration(conferenceId, paperId, { audience });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save audience');
    } finally {
      setBusy(false);
    }
  }

  async function onUploadDoc(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const presigned = await initiateStudentDocUpload(conferenceId, paperId, {
        originalFilename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      await completeStudentDocUpload(conferenceId, paperId, { objectKey: presigned.objectKey });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document upload failed');
    } finally {
      setBusy(false);
    }
  }

  async function onPay() {
    setBusy(true);
    setError(null);
    try {
      const payment = await initiatePayment(conferenceId, paperId);
      if (payment.provider === 'mock' || payment.keyId === 'mock_key_id') {
        setError('Payment initiated — complete via test webhook in integration environment.');
        await load();
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
        document.body.appendChild(script);
      });

      if (!window.Razorpay) {
        throw new Error('Razorpay checkout unavailable');
      }

      const rzp = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amountMinor,
        currency: payment.currency,
        order_id: payment.orderId,
        name: 'FresiCMT',
        description: 'Conference registration',
        handler: () => {
          void load();
        },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading registration…</p>;
  }

  if (!registration) {
    return null;
  }

  const earlyBirdEndsAt = registration.earlyBirdEndsAt ?? registration.feeSchedule?.earlyBirdEndsAt;
  const deadlinePassed = new Date(registration.deadlineAt) < new Date();
  const canPay =
    !deadlinePassed &&
    (registration.status === 'PENDING' || registration.status === 'ADDITIONAL_PAYMENT_REQUIRED') &&
    (registration.audience !== 'STUDENT' || Boolean(registration.latestVerification));

  const showAudienceForm = registration.status === 'PENDING' && !registration.lockedTiming;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Conference registration</CardTitle>
        <CardDescription>
          Status: {registration.status.replace(/_/g, ' ').toLowerCase()}
          {registration.lockedTiming ? ` · ${registration.lockedTiming} rate locked` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Deadline: {new Date(registration.deadlineAt).toLocaleString()}
          {deadlinePassed ? ' (passed)' : ''}
        </p>

        {earlyBirdEndsAt ? (
          <p className="text-sm text-muted-foreground">
            Early bird ends: {new Date(earlyBirdEndsAt).toLocaleString()}
          </p>
        ) : null}

        {showAudienceForm ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="audience">Registration category</Label>
              <select
                id="audience"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={audience}
                disabled={busy}
                onChange={(e) => setAudience(e.target.value as 'REGULAR' | 'STUDENT')}
              >
                <option value="REGULAR">Regular author</option>
                <option value="STUDENT">Student author</option>
              </select>
            </div>
            <Button onClick={onChooseAudience} disabled={busy}>
              Continue
            </Button>
          </div>
        ) : null}

        {registration.audience === 'STUDENT' &&
        registration.status !== 'PAID' &&
        !registration.latestVerification ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="student-doc">
              Upload student verification document (PDF/JPEG/PNG)
            </label>
            <input
              id="student-doc"
              type="file"
              accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
              onChange={onUploadDoc}
              disabled={busy}
            />
          </div>
        ) : null}

        {registration.latestVerification ? (
          <p className="text-sm">
            Verification: {registration.latestVerification.status.replace(/_/g, ' ').toLowerCase()}
            {registration.latestVerification.note
              ? ` — ${registration.latestVerification.note}`
              : ''}
          </p>
        ) : null}

        {registration.amountDueMinor > 0 ? (
          <p className="text-sm font-medium">
            Amount due: {formatMoney(registration.amountDueMinor, registration.currency)}
          </p>
        ) : null}

        {canPay ? (
          <Button onClick={onPay} disabled={busy}>
            {registration.status === 'ADDITIONAL_PAYMENT_REQUIRED' ? 'Pay difference' : 'Pay now'}
          </Button>
        ) : null}

        {registration.status === 'PAID' || registration.status === 'AWAITING_VERIFICATION' ? (
          <p className="text-sm text-green-700">
            {registration.status === 'AWAITING_VERIFICATION'
              ? 'Payment received — awaiting student verification.'
              : 'Registration complete.'}
          </p>
        ) : null}

        {registration.invoice?.downloadUrl ? (
          <a
            className="text-sm text-primary underline"
            href={registration.invoice.downloadUrl}
            target="_blank"
            rel="noreferrer"
          >
            Download invoice {registration.invoice.number}
          </a>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
