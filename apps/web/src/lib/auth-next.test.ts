import { describe, expect, it } from 'vitest';
import { safeAuthNext, signInWithNext } from './auth-next';

const registration =
  '/dashboard/conferences/conf/submissions/paper?section=registration&round=round#payment';
describe('post-login destination', () => {
  it('round-trips the full registration destination through sign-in', () => {
    const url = new URL(signInWithNext(registration), 'https://app.example');
    expect(url.pathname).toBe('/sign-in');
    expect(safeAuthNext(url.searchParams.get('next'))).toBe(registration);
  });
  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\nevil.example',
    'javascript:alert(1)',
    '/dashboard/..//evil.example',
    '/sign-in?next=/dashboard',
    '/mfa/challenge',
  ])('rejects unsafe or looping destination %j', (value) => {
    expect(safeAuthNext(value)).toBeNull();
  });
  it('defaults to ordinary sign-in when no safe destination exists', () => {
    expect(signInWithNext('//evil.example')).toBe('/sign-in');
  });
});
