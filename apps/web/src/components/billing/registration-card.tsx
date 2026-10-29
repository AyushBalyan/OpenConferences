'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { StudentDocumentUpload } from './student-document-upload';
import { createRegistration, fetchRegistration, initiatePayment } from '@/lib/api-client';
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
      setError('Registration could not be loaded. Please try again.');
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

  async function onPay() {
    setBusy(true);
    setError(null);
    try {
      const payment = await initiatePayment(conferenceId, paperId);
      if (payment.provider === 'mock' || payment.keyId === 'mock_key_id') {
        await load();
        setError('Online payment is unavailable right now. Please contact the organizers.');
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
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <p role="alert" className="text-sm text-slate-700">
          {error ?? 'Registration is not available yet.'}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          Retry loading registration
        </Button>
      </div>
    );
  }

  const earlyBirdEndsAt = registration.earlyBirdEndsAt ?? registration.feeSchedule?.earlyBirdEndsAt;
  const deadlinePassed = new Date(registration.deadlineAt) < new Date();
  const canPay =
    !deadlinePassed &&
    (registration.status === 'PENDING' || registration.status === 'ADDITIONAL_PAYMENT_REQUIRED') &&
    (registration.audience !== 'STUDENT' || Boolean(registration.latestVerification));

  const showAudienceForm = registration.status === 'PENDING' && !registration.lockedTiming;

  return (
    <section
      aria-labelledby="registration-title"
      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
    >
      <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
        <h2 id="registration-title" className="text-xl font-semibold tracking-tight text-slate-900">
          Conference registration
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose your author category and complete payment for this paper.
        </p>
        <p className="mt-3 text-sm font-medium tabular-nums text-slate-700 lg:hidden">
          Due{' '}
          {new Date(registration.deadlineAt).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}{' '}
          ·{' '}
          {new Date(registration.deadlineAt).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
          })}
        </p>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-5">
            <h3 className="text-base font-medium text-slate-900">
              {registration.status === 'PAID' ? 'Registration complete' : 'Author registration'}
            </h3>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium capitalize text-slate-700">
              {registration.status.replace(/_/g, ' ').toLowerCase()}
            </span>
          </div>

          {showAudienceForm ? (
            <div className="max-w-md space-y-3">
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
              <p className="text-sm leading-relaxed text-slate-600">
                Student authors will need to provide a verification document.
              </p>
              <Button
                variant="outline"
                className="shadow-none"
                onClick={onChooseAudience}
                disabled={busy}
              >
                Save category
              </Button>
            </div>
          ) : null}

          {registration.audience === 'STUDENT' &&
          (registration.status !== 'PAID' || registration.latestVerification) ? (
            <StudentDocumentUpload
              conferenceId={conferenceId}
              paperId={paperId}
              verification={registration.latestVerification}
              disabled={busy}
              onUploaded={load}
              onBusyChange={setBusy}
            />
          ) : null}

          {registration.amountDueMinor > 0 ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200 pt-5">
              <p className="text-sm text-slate-600">Amount due</p>
              <p className="text-2xl font-medium tabular-nums tracking-tight text-slate-900">
                {formatMoney(registration.amountDueMinor, registration.currency)}
              </p>
            </div>
          ) : null}

          {canPay ? (
            <Button
              className="bg-slate-900 shadow-none hover:translate-y-0 hover:bg-slate-800"
              onClick={onPay}
              disabled={busy}
            >
              {registration.status === 'ADDITIONAL_PAYMENT_REQUIRED' ? 'Pay difference' : 'Pay now'}
            </Button>
          ) : null}

          {registration.status === 'PAID' || registration.status === 'AWAITING_VERIFICATION' ? (
            <p className="flex items-center gap-2 text-sm text-emerald-800" role="status">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
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

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <aside className="space-y-6 border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="hidden lg:block">
            <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <CalendarDays className="h-4 w-4 text-slate-500" aria-hidden /> Registration deadline
            </p>
            <p className="mt-3 text-lg font-medium tabular-nums text-slate-900">
              {new Date(registration.deadlineAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {new Date(registration.deadlineAt).toLocaleTimeString(undefined, {
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short',
              })}
              {deadlinePassed ? ' · passed' : ''}
            </p>
          </div>
          {earlyBirdEndsAt ? (
            <div className="border-t border-slate-200 pt-5">
              <h3 className="text-sm font-medium text-slate-900">Early-bird registration</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Ends {new Date(earlyBirdEndsAt).toLocaleString()}.
                {registration.lockedTiming
                  ? ` Your ${registration.lockedTiming.toLowerCase()} rate is locked.`
                  : ''}
              </p>
            </div>
          ) : null}
          <div className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-medium text-slate-900">One paper, two final steps</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Registration and your camera-ready manuscript are tracked separately. Check the
              Camera-ready tab for your final PDF.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
