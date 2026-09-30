/**
 * Better Auth stores verification rows in Redis as JSON. Dates come back as
 * strings, and `expiresAt > new Date()` is then always false, so a trusted
 * device is rejected on the next sign-in. OTP and trust records are also
 * written to Postgres (`verification.storeInDatabase`), which returns real
 * dates. Skip the Redis copy for those keys.
 */
export function isVerificationCacheKey(key: string): boolean {
  return key.startsWith('verification:');
}

export function readSecondaryStorageValue(key: string, raw: string | null): string | null {
  if (isVerificationCacheKey(key)) return null;
  return raw ?? null;
}

export function shouldWriteSecondaryStorage(key: string): boolean {
  return !isVerificationCacheKey(key);
}

/**
 * A previous sign-in without "Remember me" leaves `dont_remember`. The next
 * session refresh treats that cookie as authoritative and drops Max-Age, so
 * checking Remember me does not survive the browser closing. Clear it when
 * this sign-in asked to be remembered.
 */
export function shouldClearDontRememberCookie(input: {
  path: string;
  rememberMe: unknown;
  hasNewSession: boolean;
}): boolean {
  if (input.path !== '/sign-in/email') return false;
  if (!input.hasNewSession) return false;
  return input.rememberMe !== false;
}
