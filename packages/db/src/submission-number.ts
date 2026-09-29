import { randomInt } from 'node:crypto';

/** Crockford-like alphabet without 0/O and 1/I. Includes U, matching the agreed 32-character set. */
export const SUBMISSION_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

const CODE_LENGTH = 4;

export function conferenceCodePrefix(slug: string): string {
  return slug.replace(/-/g, '').toUpperCase();
}

export function generateSubmissionNumber(slug: string): string {
  const prefix = conferenceCodePrefix(slug);
  if (!prefix) {
    throw new Error('Conference slug has no letters or digits to build a submission number');
  }

  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += SUBMISSION_CODE_ALPHABET[randomInt(SUBMISSION_CODE_ALPHABET.length)];
  }
  return `${prefix}-${code}`;
}
