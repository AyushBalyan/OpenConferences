'use client';

import { createAuthClient } from 'better-auth/react';
import { twoFactorClient } from 'better-auth/client/plugins';

const apiOrigin =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/v1\/?$/, '') ?? 'http://localhost:3001';

export const authClient = createAuthClient({
  baseURL: `${apiOrigin}/api/v1/auth`,
  fetchOptions: {
    credentials: 'include',
  },
  plugins: [
    twoFactorClient({
      twoFactorPage: '/mfa/challenge',
    }),
  ],
});

export function useSession() {
  return authClient.useSession();
}

export async function signOut() {
  return authClient.signOut();
}
