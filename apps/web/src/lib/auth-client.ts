'use client';

import { createAuthClient } from 'better-auth/react';
import { emailOTPClient, twoFactorClient } from 'better-auth/client/plugins';

const apiOrigin =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ?? 'http://localhost:3001';

/**
 * Better Auth's session atom runs `onMount` → `fetchSession()` whenever the
 * subscriber count goes 0 → 1. React remount churn (Strict Mode, HMR, and
 * especially Cursor's embedded browser) repeatedly tears the count down to 0,
 * so each remount schedules another GET /get-session. In-flight dedupe alone
 * cannot stop that — the calls are sequential, a few ms apart.
 *
 * Two guards:
 * 1. Sticky retainer listener keeps the atom mounted for the tab lifetime.
 * 2. Short TTL cache coalesces any remaining sequential GETs.
 */
const GET_SESSION_TTL_MS = 5_000;

let inFlightGetSession: Promise<Response> | null = null;
let cachedGetSession: { at: number; response: Response } | null = null;
let bypassGetSessionCache = false;

function bustGetSessionCache(): void {
  cachedGetSession = null;
  bypassGetSessionCache = true;
}

const dedupedFetch: typeof fetch = (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isGetSession = method === 'GET' && url.includes('/get-session');

  if (!isGetSession) {
    return fetch(input, init);
  }

  const now = Date.now();
  const allowCache = !bypassGetSessionCache;
  bypassGetSessionCache = false;

  if (allowCache && cachedGetSession !== null && now - cachedGetSession.at < GET_SESSION_TTL_MS) {
    return Promise.resolve(cachedGetSession.response.clone());
  }

  if (!inFlightGetSession) {
    // Intentionally omit per-caller AbortSignal so remount aborts cannot cancel
    // the shared request and immediately schedule a replacement.
    const { signal: _signal, ...rest } = init ?? {};
    inFlightGetSession = fetch(input, rest)
      .then((response) => {
        cachedGetSession = { at: Date.now(), response: response.clone() };
        return response;
      })
      .finally(() => {
        inFlightGetSession = null;
      });
  }

  return inFlightGetSession.then((response) => response.clone());
};

export const authClient = createAuthClient({
  baseURL: `${apiOrigin}/api/v1/auth`,
  fetchOptions: {
    credentials: 'include',
    customFetchImpl: dedupedFetch,
  },
  // Cursor Simple Browser flaps visibility; disable focus-driven refetch.
  sessionOptions: {
    refetchOnWindowFocus: false,
    refetchInterval: 0,
  },
  plugins: [
    emailOTPClient(),
    twoFactorClient({
      twoFactorPage: '/mfa/challenge',
    }),
  ],
});

function getSessionAtom() {
  const sessionAtom = authClient.$store.atoms.session;
  if (!sessionAtom) {
    throw new Error('Better Auth session atom is unavailable');
  }
  return sessionAtom;
}

// Keep the session atom mounted for the lifetime of the tab so React remount
// churn cannot re-enter Better Auth's onMount → fetchSession path.
if (typeof window !== 'undefined') {
  getSessionAtom().listen(() => {
    /* retainer */
  });
}

export function useSession() {
  return authClient.useSession();
}

/** Wait until the session atom reflects the cookie (e.g. after sign-in). */
export async function refreshSession() {
  bustGetSessionCache();
  const sessionAtom = getSessionAtom();
  await sessionAtom.get().refetch();
  return sessionAtom.get();
}

export async function signOut() {
  bustGetSessionCache();
  return authClient.signOut();
}
