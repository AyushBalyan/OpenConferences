export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

export const isTurnstileEnabled = turnstileSiteKey.length > 0;

export const TURNSTILE_RESPONSE_HEADER = 'cf-turnstile-response';

export function turnstileFetchOptions(token: string | null) {
  if (!isTurnstileEnabled || !token) {
    return undefined;
  }

  return {
    headers: {
      [TURNSTILE_RESPONSE_HEADER]: token,
    },
  };
}

export function withTurnstileBody<T extends Record<string, unknown>>(
  values: T,
  token: string | null,
): T & { cfTurnstileResponse?: string } {
  if (!isTurnstileEnabled || !token) {
    return values;
  }

  return { ...values, cfTurnstileResponse: token };
}
