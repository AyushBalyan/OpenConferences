/** Stable API detail from MembershipGuard when privileged actions require MFA. */
export const MFA_REQUIRED_DETAIL = 'Multi-factor authentication is required for this action';

export class MfaRequiredError extends Error {
  readonly status = 403 as const;

  constructor(message = MFA_REQUIRED_DETAIL) {
    super(message);
    this.name = 'MfaRequiredError';
  }
}

export function isMfaRequiredError(error: unknown): error is MfaRequiredError {
  if (error instanceof MfaRequiredError) return true;
  if (!(error instanceof Error)) return false;
  return error.message.includes(MFA_REQUIRED_DETAIL);
}

export function mfaEnrollHref(nextPath: string): string {
  const next = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/me/dashboard';
  return `/mfa/enroll?next=${encodeURIComponent(next)}`;
}
