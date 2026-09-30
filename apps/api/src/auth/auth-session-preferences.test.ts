import { describe, expect, it } from 'vitest';
import {
  readSecondaryStorageValue,
  shouldClearDontRememberCookie,
  shouldWriteSecondaryStorage,
} from './auth-session-preferences';

describe('auth session preferences', () => {
  it('does not cache verification rows in redis', () => {
    expect(shouldWriteSecondaryStorage('verification:trust-device-abc')).toBe(false);
    expect(
      readSecondaryStorageValue(
        'verification:trust-device-abc',
        '{"expiresAt":"2099-01-01T00:00:00.000Z"}',
      ),
    ).toBeNull();
    expect(shouldWriteSecondaryStorage('session-token')).toBe(true);
    expect(readSecondaryStorageValue('session-token', 'session')).toBe('session');
  });

  it('clears a stale dont-remember cookie only when this sign-in is remembered', () => {
    expect(
      shouldClearDontRememberCookie({
        path: '/sign-in/email',
        rememberMe: true,
        hasNewSession: true,
      }),
    ).toBe(true);
    expect(
      shouldClearDontRememberCookie({
        path: '/sign-in/email',
        rememberMe: false,
        hasNewSession: true,
      }),
    ).toBe(false);
    expect(
      shouldClearDontRememberCookie({
        path: '/sign-in/email',
        rememberMe: true,
        hasNewSession: false,
      }),
    ).toBe(false);
  });
});
