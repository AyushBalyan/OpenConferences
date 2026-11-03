import { describe, expect, it } from 'vitest';
import { effectiveConferenceStatus, isCfpOpen } from './conference-phase.js';
const window = {
  status: 'CFP_OPEN',
  cfpOpensAt: '2026-11-01T00:00:00Z',
  cfpClosesAt: '2026-11-03T10:00:00+05:30',
};
describe('CFP submission window', () => {
  it('opens inclusively and closes exclusively, comparing absolute instants', () => {
    expect(isCfpOpen(window, new Date(window.cfpOpensAt))).toBe(true);
    expect(isCfpOpen(window, new Date('2026-11-03T04:29:59.999Z'))).toBe(true);
    expect(isCfpOpen(window, new Date('2026-11-03T04:30:00.000Z'))).toBe(false);
    expect(effectiveConferenceStatus(window, new Date('2026-11-03T04:30:00Z'))).toBe('CFP_CLOSED');
  });
  it('stays closed without review dates and after all downstream deadlines', () => {
    expect(effectiveConferenceStatus(window, new Date('2030-01-01'))).toBe('CFP_CLOSED');
  });
  it.each(['CFP_CLOSED', 'REVIEWING', 'DECISIONS', 'FINALIZATION', 'COMPLETED', 'ARCHIVED'])(
    'preserves the explicit %s phase while the original CFP dates are active',
    (status) => {
      expect(effectiveConferenceStatus({ ...window, status }, new Date('2026-11-02'))).toBe(status);
      expect(isCfpOpen({ ...window, status }, new Date('2026-11-02'))).toBe(false);
    },
  );
  it('rejects future, missing, invalid or reversed windows', () => {
    expect(isCfpOpen(window, new Date('2026-10-01'))).toBe(false);
    expect(isCfpOpen({ status: 'CFP_OPEN' })).toBe(false);
    expect(isCfpOpen({ ...window, cfpClosesAt: 'invalid' })).toBe(false);
    expect(isCfpOpen({ ...window, cfpOpensAt: '2027-01-01' }, new Date('2026-11-02'))).toBe(false);
  });
  it('requires publication before accepting papers even when the dates are active', () => {
    expect(isCfpOpen({ ...window, status: 'DRAFT' }, new Date('2026-11-02'))).toBe(false);
  });
});
