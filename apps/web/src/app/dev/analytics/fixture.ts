import type { ConferenceAnalyticsOverview } from '@openconferences/schemas';
const id = '00000000-0000-4000-8000-000000000001';
// Synthetic, development-only conference data. No live API or database is used.
export function analyticsPreviewFixture(): ConferenceAnalyticsOverview {
  const data: ConferenceAnalyticsOverview = {
    conferenceId: id,
    computedAt: '2026-10-09T10:30:00.000Z',
    submissions: {
      total: 96,
      excluded: { draft: 8, withdrawn: 5 },
      byStatus: [
        { status: 'SUBMITTED', count: 22 },
        { status: 'UNDER_REVIEW', count: 55 },
        { status: 'DECISION_MADE', count: 15 },
        { status: 'CAMERA_READY', count: 4 },
      ],
      byDay: Array.from({ length: 20 }, (_, i) => ({
        date: `2026-09-${String(i + 1).padStart(2, '0')}`,
        count: [2, 3, 4, 0, 6, 4, 8, 6, 4, 7, 3, 4, 6, 5, 3, 9, 4, 2, 7, 9][i]!,
      })),
    },
    reviews: {
      assigned: 180,
      completed: 112,
      submitted: 112,
      draft: 33,
      notStarted: 21,
      closedIncomplete: 12,
      inconsistent: 2,
      overdue: 14,
      underCoveredPapers: 23,
      reviewerLoad: Array.from({ length: 12 }, (_, i) => ({
        id: String(i),
        name: [
          'Alexandra Montgomery',
          'Samira Rahman',
          'Daniel Chen',
          'Priya Deshmukh',
          'Gabriel Santos',
          'Nora O’Connor',
          'Yuki Tanaka',
          'Sofia Martínez',
          'Kwame Mensah',
          'Elena Petrova',
          'Amir Hassan',
          'Mei Lin',
        ][i]!,
        count: [8, 7, 6, 5, 4, 4, 4, 4, 3, 3, 3, 3][i]!,
      })),
    },
    decisions: {
      total: 19,
      acceptRate: 12 / 19,
      byOutcome: [
        { outcome: 'ACCEPT', count: 12 },
        { outcome: 'REJECT', count: 3 },
        { outcome: 'MINOR_REVISION', count: 3 },
        { outcome: 'MAJOR_REVISION', count: 1 },
      ],
    },
    registrations: {
      total: 27,
      paid: 19,
      unpaid: 5,
      atRisk: 2,
      overdue: 1,
      byStatus: [
        { status: 'PAID', count: 19 },
        { status: 'PENDING', count: 3 },
        { status: 'AWAITING_VERIFICATION', count: 2 },
        { status: 'CANCELLED', count: 3 },
      ],
    },
    // Demo schedule: 1 USD = 83.27 INR; INR 83,270 converts to USD 1,000.
    currency: 'USD',
    revenueMinor: 302500,
    revenueConversion: {
      inrPerUsd: 83.27,
      capturedMinor: 327500,
      refundedMinor: 25000,
      byCurrency: [
        {
          currency: 'INR',
          capturedMinor: 8327000,
          refundedMinor: 0,
          netMinor: 8327000,
          convertedMinor: 100000,
          paymentCount: 8,
        },
        {
          currency: 'USD',
          capturedMinor: 227500,
          refundedMinor: 25000,
          netMinor: 202500,
          convertedMinor: 202500,
          paymentCount: 12,
        },
      ],
    },
    revenueByTiming: [
      { name: 'EARLY', amountMinor: 230000 },
      { name: 'REGULAR', amountMinor: 72500 },
    ],
    revenueByAudience: [
      { name: 'STUDENT', amountMinor: 100000 },
      { name: 'REGULAR', amountMinor: 202500 },
    ],
    excludedCurrencyPayments: 0,
    unpaidAccepted: 3,
    authors: Array.from({ length: 25 }, (_, i) => ({
      name:
        ['Aarav Sharma', 'Nadia Ahmed', 'Chen Wei', 'Maria Fernandes'][i] ??
        [
          'Leila Haddad',
          'Oliver Brooks',
          'Aisha Patel',
          'Mateo Silva',
          'Hana Kim',
          'James Wilson',
          'Fatima Noor',
          'Luca Rossi',
          'Anika Bose',
          'Noah Clark',
          'Sana Malik',
          'Ethan Cole',
          'Mina Park',
          'Adam Lewis',
          'Riya Nair',
          'Leo Martin',
          'Zara Khan',
          'Iris Wang',
          'Omar Ali',
          'Eva Fischer',
          'Arjun Mehta',
        ][i - 4]!,
      count: i < 4 ? 6 : i < 13 ? 4 : 3,
    })),
    institutions: [
      { name: 'Indian Institute of Technology, Bombay', count: 16 },
      { name: 'National University of Singapore', count: 13 },
      { name: 'University of Cambridge', count: 11 },
      { name: 'Massachusetts Institute of Technology', count: 9 },
      { name: 'École Polytechnique Fédérale de Lausanne', count: 8 },
      { name: 'University of California, Berkeley', count: 7 },
      { name: 'Unspecified', count: 6 },
    ],
  };
  // Preview reports use amounts chosen to convert exactly at the demonstration rate.
  // The real API builds each report from individual ledger records before rounding.
  const inr = (amount: number) => Math.round(amount * 83.27);
  data.currencyReports = [
    {
      currency: data.currency,
      revenueMinor: data.revenueMinor,
      revenueByTiming: data.revenueByTiming,
      revenueByAudience: data.revenueByAudience,
      revenueConversion: data.revenueConversion,
      excludedCurrencyPayments: 0,
    },
    {
      currency: 'INR',
      revenueMinor: inr(data.revenueMinor),
      revenueByTiming: data.revenueByTiming.map((row) => ({
        ...row,
        amountMinor: inr(row.amountMinor),
      })),
      revenueByAudience: data.revenueByAudience.map((row) => ({
        ...row,
        amountMinor: inr(row.amountMinor),
      })),
      excludedCurrencyPayments: 0,
      revenueConversion: {
        ...data.revenueConversion!,
        capturedMinor: inr(data.revenueConversion!.capturedMinor),
        refundedMinor: inr(data.revenueConversion!.refundedMinor),
        byCurrency: data.revenueConversion!.byCurrency.map((row) => ({
          ...row,
          convertedMinor: row.currency === 'INR' ? row.netMinor : inr(row.netMinor),
        })),
      },
    },
  ];
  return data;
}
