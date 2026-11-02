'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { StudentDocumentUpload } from './student-document-upload';
import {
  createRegistration,
  fetchRegistration,
  fetchInvoiceDownload,
  initiatePayment,
  verifyPayment,
} from '@/lib/api-client';
import { BILLING_COUNTRIES, type RegistrationDetailDto } from '@openconferences/schemas';
import { useCallback, useEffect, useState } from 'react';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: 'payment.failed', callback: () => void) => void;
    };
  }
}

let checkoutScript: Promise<void> | null = null;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScript) {
    checkoutScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      const timer = window.setTimeout(() => fail(), 20000);
      const fail = () => {
        window.clearTimeout(timer);
        script.remove();
        checkoutScript = null;
        reject(new Error('Checkout could not load. Check your connection and try again.'));
      };
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        window.clearTimeout(timer);
        resolve();
      };
      script.onerror = fail;
      document.body.appendChild(script);
    });
  }
  return checkoutScript;
}
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countries = BILLING_COUNTRIES.map((code) => ({
  code,
  name: countryNames.of(code) ?? code,
})).sort((a, b) => a.name.localeCompare(b.name, 'en'));

type RegistrationCardProps = {
  conferenceId: string;
  conferenceName: string;
  paperId: string;
};

function formatMoney(minor: number, currency: string): string {
  return `${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })} ${currency}`;
}

export function RegistrationCard({ conferenceId, conferenceName, paperId }: RegistrationCardProps) {
  const [registration, setRegistration] = useState<RegistrationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingCountry, setBillingCountry] = useState('');
  const [billingAffiliation, setBillingAffiliation] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [audience, setAudience] = useState<'REGULAR' | 'STUDENT'>('REGULAR');

  const load = useCallback(async () => {
    try {
      const data = await fetchRegistration(conferenceId, paperId);
      setRegistration(data);
      setBillingCountry(data.billingCountry ?? '');
      setBillingAffiliation(data.billingAffiliation ?? '');
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
      if (!billingAffiliation.trim()) throw new Error('Enter your affiliation for the invoice.');
      await createRegistration(conferenceId, paperId, {
        audience,
        billingCountry,
        billingAffiliation: billingAffiliation.trim(),
      });
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
      setRegistration((current) =>
        current
          ? { ...current, ...payment.registration, paymentQuote: null, paymentQuoteError: null }
          : current,
      );

      await loadCheckout();
      if (!window.Razorpay) throw new Error('Razorpay checkout unavailable');
      setMessage(null);
      await new Promise<void>((resolve, reject) => {
        let confirming = false;
        const rzp = new window.Razorpay!({
          key: payment.keyId,
          amount: payment.amountMinor,
          currency: payment.currency,
          order_id: payment.orderId,
          name: conferenceName.trim() || 'Conference registration',
          description: payment.registration.isAdditionalPaper
            ? 'Additional accepted paper registration'
            : 'Conference paper registration',
          handler: (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            confirming = true;
            void (async () => {
              try {
                const result = await verifyPayment(conferenceId, paperId, response);
                await load();
                setMessage(
                  result.captured
                    ? 'Payment received for this paper.'
                    : 'Payment signature verified. Confirmation is pending; refresh registration shortly.',
                );
                resolve();
              } catch (error) {
                reject(error);
              }
            })();
          },
          modal: {
            ondismiss: () => {
              if (!confirming) {
                setMessage(
                  'Checkout closed. Registration has not been confirmed; you can reopen checkout to continue.',
                );
                resolve();
              }
            },
          },
        });
        rzp.on('payment.failed', () => {
          setError(
            'Payment failed. Try another payment method in checkout or close it to try later.',
          );
        });
        rzp.open();
      });
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
  const deadlinePassed =
    new Date(registration.additionalGraceUntil ?? registration.deadlineAt) < new Date();
  const canPay =
    !deadlinePassed &&
    audience === registration.audience &&
    billingCountry === (registration.billingCountry ?? '') &&
    Boolean(billingAffiliation.trim()) &&
    billingAffiliation.trim() === (registration.billingAffiliation ?? '').trim() &&
    !registration.paymentQuoteError &&
    (Boolean(registration.lockedTiming) || Boolean(registration.paymentQuote)) &&
    (registration.status === 'PENDING' || registration.status === 'ADDITIONAL_PAYMENT_REQUIRED') &&
    (registration.audience !== 'STUDENT' ||
      registration.status === 'ADDITIONAL_PAYMENT_REQUIRED' ||
      ['PENDING', 'APPROVED'].includes(registration.latestVerification?.status ?? ''));

  const detailsLocked = registration.status !== 'PENDING' || Boolean(registration.lockedTiming);
  const showAudienceForm =
    !detailsLocked ||
    (!registration.billingAffiliation &&
      ['PENDING', 'ADDITIONAL_PAYMENT_REQUIRED'].includes(registration.status));
  const netPaid = (registration.payments ?? []).reduce((sum, payment) => {
    if (payment.kind === 'REFUND' && ['REFUNDED', 'PARTIALLY_REFUNDED'].includes(payment.status))
      return sum - payment.amountMinor;
    return payment.status === 'CAPTURED' && payment.kind !== 'REFUND'
      ? sum + payment.amountMinor
      : sum;
  }, 0);
  const displayedAmount =
    registration.status === 'ADDITIONAL_PAYMENT_REQUIRED'
      ? Math.max(0, registration.amountDueMinor - netPaid)
      : (registration.paymentQuote?.amountMinor ?? registration.amountDueMinor);

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
                <Label htmlFor="billing-affiliation">Affiliation (required)</Label>
                <input
                  id="billing-affiliation"
                  value={billingAffiliation}
                  maxLength={300}
                  required
                  disabled={busy}
                  onChange={(event) => setBillingAffiliation(event.target.value)}
                  aria-describedby="billing-affiliation-help"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                />
                <p id="billing-affiliation-help" className="text-sm text-slate-600">
                  {registration.billingAffiliation
                    ? 'Your saved affiliation is shown below your name on the invoice.'
                    : 'Enter your institution or organization for the invoice before payment.'}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Registration category</Label>
                <select
                  id="audience"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={audience}
                  disabled={busy || detailsLocked}
                  onChange={(e) => setAudience(e.target.value as 'REGULAR' | 'STUDENT')}
                >
                  <option value="REGULAR">Regular author</option>
                  <option value="STUDENT">Student author</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-country">Billing country</Label>
                <select
                  id="billing-country"
                  value={billingCountry}
                  disabled={busy || detailsLocked}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base"
                  onChange={(event) => setBillingCountry(event.target.value)}
                >
                  <option value="">Select your country</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
                <p className="text-sm text-slate-600">
                  {registration.feeSchedule?.currency === 'USD' || registration.currency === 'USD'
                    ? 'Indian authors pay in INR. Authors outside India pay in USD.'
                    : `Payment currency: ${registration.currency}.`}
                </p>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                Student authors will need to provide a verification document.
              </p>
              <Button
                variant="outline"
                className="shadow-none"
                onClick={onChooseAudience}
                disabled={busy || !billingCountry}
              >
                Save registration details
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

          {registration.paymentQuoteError ? (
            <p role="status" className="text-sm text-slate-700">
              {registration.paymentQuoteError}
            </p>
          ) : null}
          {registration.paymentQuote?.isAdditionalPaper || registration.isAdditionalPaper ? (
            <p className="text-sm text-slate-700">
              Additional-paper fee: you have already paid the base registration for another paper in
              this conference.
            </p>
          ) : null}
          {displayedAmount > 0 ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-slate-200 pt-5">
              <p className="text-sm text-slate-600">
                {['PAID', 'AWAITING_VERIFICATION'].includes(registration.status)
                  ? 'Registration fee'
                  : 'Amount due'}
              </p>
              <p className="text-2xl font-medium tabular-nums tracking-tight text-slate-900">
                {formatMoney(
                  displayedAmount,
                  registration.paymentQuote?.currency ?? registration.currency,
                )}
              </p>
            </div>
          ) : null}

          {canPay ? (
            <Button
              className="bg-slate-900 shadow-none hover:translate-y-0 hover:bg-slate-800"
              onClick={onPay}
              disabled={busy}
            >
              {busy
                ? 'Processing payment…'
                : registration.status === 'ADDITIONAL_PAYMENT_REQUIRED'
                  ? 'Pay difference'
                  : 'Pay now'}
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

          {registration.invoice ? (
            <Button
              variant="outline"
              disabled={downloadingInvoice}
              onClick={async () => {
                setDownloadingInvoice(true);
                setError(null);
                try {
                  const url = await fetchInvoiceDownload(conferenceId, paperId);
                  window.location.assign(url);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Invoice could not be downloaded.');
                } finally {
                  setDownloadingInvoice(false);
                }
              }}
            >
              {downloadingInvoice
                ? 'Opening invoice…'
                : `Download invoice ${registration.invoice.number}`}
            </Button>
          ) : null}

          {message ? (
            <p role="status" className="text-sm text-slate-700">
              {message}
            </p>
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
                Available before{' '}
                {new Date(earlyBirdEndsAt).toLocaleString('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  timeZoneName: 'short',
                })}
                .
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
