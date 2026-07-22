const AUTHOR_JOIN_TOKEN_KEY = 'oc:author-join-token';
const AUTHOR_AFFILIATION_KEY = 'oc:author-affiliation';

export function storeAuthorJoinToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(AUTHOR_JOIN_TOKEN_KEY, token);
}

export function getStoredAuthorJoinToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(AUTHOR_JOIN_TOKEN_KEY);
}

export function clearStoredAuthorJoinToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTHOR_JOIN_TOKEN_KEY);
  sessionStorage.removeItem(AUTHOR_AFFILIATION_KEY);
}

export function storeAuthorAffiliation(affiliation: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = affiliation.trim();
  if (trimmed) {
    sessionStorage.setItem(AUTHOR_AFFILIATION_KEY, trimmed);
  } else {
    sessionStorage.removeItem(AUTHOR_AFFILIATION_KEY);
  }
}

export function getStoredAuthorAffiliation(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(AUTHOR_AFFILIATION_KEY);
}

/** URL query value if present, otherwise sessionStorage (survives email verification redirect). */
export function resolveAuthorJoinToken(queryValue: string | null): string | null {
  const trimmed = queryValue?.trim() ?? '';
  if (trimmed) {
    storeAuthorJoinToken(trimmed);
    return trimmed;
  }
  return getStoredAuthorJoinToken();
}

export function authorJoinQuery(token: string | null): string {
  return token ? `?authorJoin=${encodeURIComponent(token)}` : '';
}

export function authorJoinPath(token: string): string {
  return `/join/author?token=${encodeURIComponent(token)}`;
}
