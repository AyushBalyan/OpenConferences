import { describe, expect, it } from 'vitest';
import { CONFERENCE_2026_FEES } from '@openconferences/schemas';
import { quoteRegistration } from './fee-resolver';

const early = new Date('2026-11-19T18:29:59.999Z');
const regular = new Date('2026-11-19T18:30:00.000Z');

describe('Conference registration pricing', () => {
  it.each([
    ['REGULAR', early, 12500],
    ['STUDENT', early, 7500],
    ['REGULAR', regular, 15000],
    ['STUDENT', regular, 10000],
  ] as const)('prices %s at %s as %i USD cents', (audience, now, amount) => {
    expect(quoteRegistration(CONFERENCE_2026_FEES, audience, 'US', false, now)).toMatchObject({
      amountMinor: amount,
      currency: 'USD',
      isAdditionalPaper: false,
    });
  });

  it('keeps the early rate for a paper whose own cut-off is later than the conference one', () => {
    const after = new Date('2026-11-25T00:00:00.000Z');
    const quote = (extendedUntil: Date | null) =>
      quoteRegistration(CONFERENCE_2026_FEES, 'REGULAR', 'US', false, after, extendedUntil);
    expect(quote(null)).toMatchObject({ timing: 'REGULAR', amountMinor: 15000 });
    expect(quote(new Date('2026-11-30T00:00:00.000Z'))).toMatchObject({
      timing: 'EARLY',
      amountMinor: 12500,
    });
    // Once the paper's own cut-off passes, the regular rate applies again.
    expect(quote(new Date('2026-11-24T00:00:00.000Z'))).toMatchObject({ timing: 'REGULAR' });
    // An extension can never shorten the conference's early-bird period.
    expect(
      quoteRegistration(
        CONFERENCE_2026_FEES,
        'REGULAR',
        'US',
        false,
        early,
        new Date('2026-11-01T00:00:00.000Z'),
      ),
    ).toMatchObject({ timing: 'EARLY' });
  });

  it('charges $50 for a later accepted paper in either category and time period', () => {
    for (const audience of ['REGULAR', 'STUDENT'] as const) {
      for (const now of [early, regular]) {
        expect(quoteRegistration(CONFERENCE_2026_FEES, audience, 'GB', true, now)).toMatchObject({
          amountMinor: 5000,
          regularAmountMinor: 5000,
          isAdditionalPaper: true,
        });
      }
    }
  });

  it('requires an explicit country and INR rate rather than inventing conversion', () => {
    expect(() => quoteRegistration(CONFERENCE_2026_FEES, 'REGULAR', null, false, early)).toThrow(
      'country',
    );
    expect(() => quoteRegistration(CONFERENCE_2026_FEES, 'REGULAR', 'IN', false, early)).toThrow(
      'not configured',
    );
  });

  it('converts Indian fees to paise and preserves the regular equivalent for student rejection', () => {
    const schedule = { ...CONFERENCE_2026_FEES, domesticInrPerUsd: 83.27 };
    expect(quoteRegistration(schedule, 'STUDENT', 'IN', false, early)).toMatchObject({
      amountMinor: 624525,
      regularAmountMinor: 1040875,
      currency: 'INR',
    });
    expect(quoteRegistration(schedule, 'STUDENT', 'IN', true, regular)).toMatchObject({
      amountMinor: 416350,
      regularAmountMinor: 416350,
      currency: 'INR',
    });
  });

  it('keeps existing single-currency conference schedules compatible', () => {
    const schedule = { ...CONFERENCE_2026_FEES, currency: 'INR', additionalPaperMinor: undefined };
    expect(quoteRegistration(schedule, 'REGULAR', null, true, early)).toMatchObject({
      amountMinor: 12500,
      currency: 'INR',
      isAdditionalPaper: false,
    });
  });
});
