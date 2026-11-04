/** Accept only local app destinations, never an external or protocol-relative URL. */
export function safeAuthNext(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 32 || code === 127;
    })
  )
    return null;
  try {
    const url = new URL(value, 'https://app.example');
    if (url.origin !== 'https://app.example' || url.pathname.startsWith('//')) return null;
    if (['/sign-in', '/sign-up', '/mfa/challenge'].includes(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function signInWithNext(destination: string): string {
  const next = safeAuthNext(destination);
  return next ? `/sign-in?${new URLSearchParams({ next })}` : '/sign-in';
}
