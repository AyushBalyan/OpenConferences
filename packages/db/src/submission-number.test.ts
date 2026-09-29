import { describe, expect, it } from 'vitest';
import {
  SUBMISSION_CODE_ALPHABET,
  conferenceCodePrefix,
  generateSubmissionNumber,
} from './submission-number.js';

describe('conferenceCodePrefix', () => {
  it('strips hyphens and uppercases the slug', () => {
    expect(conferenceCodePrefix('mech-conf-2026')).toBe('MECHCONF2026');
  });

  it('returns an empty prefix when the slug is only hyphens', () => {
    expect(conferenceCodePrefix('---')).toBe('');
  });
});

describe('generateSubmissionNumber', () => {
  it('builds a prefix plus a 4-character code from the public alphabet', () => {
    const number = generateSubmissionNumber('mech-conf-2026');
    expect(number).toMatch(/^MECHCONF2026-[2-9A-HJ-NP-Z]{4}$/);
    const suffix = number.slice(-4);
    for (const character of suffix) {
      expect(SUBMISSION_CODE_ALPHABET.includes(character)).toBe(true);
    }
  });

  it('refuses a slug that normalizes to nothing', () => {
    expect(() => generateSubmissionNumber('---')).toThrow(/letters or digits/);
  });
});
