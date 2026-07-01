const REVIEWER_INVITE_TOKEN_KEY = 'oc:reviewer-invite-token';

export function storeReviewerInviteToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(REVIEWER_INVITE_TOKEN_KEY, token);
}

export function getStoredReviewerInviteToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(REVIEWER_INVITE_TOKEN_KEY);
}

export function clearStoredReviewerInviteToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(REVIEWER_INVITE_TOKEN_KEY);
}

/** URL query value if present, otherwise sessionStorage (survives email verification redirect). */
export function resolveReviewerInviteToken(queryValue: string | null): string | null {
  const trimmed = queryValue?.trim() ?? '';
  if (trimmed) {
    storeReviewerInviteToken(trimmed);
    return trimmed;
  }
  return getStoredReviewerInviteToken();
}
