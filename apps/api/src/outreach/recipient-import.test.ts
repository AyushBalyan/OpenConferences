import { describe, expect, it } from 'vitest';
import { validateRecipientRows } from './recipient-import';

describe('validateRecipientRows', () => {
  it('accepts a valid row and normalizes email', () => {
    const result = validateRecipientRows([
      {
        rowNumber: 2,
        name: 'Dr. John Smith',
        email: 'John@Example.com',
        topic: 'Artificial Intelligence',
        paper: 'Advances in Machine learning technologies',
      },
    ]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.email).toBe('john@example.com');
    expect(result.invalidRows).toHaveLength(0);
  });

  it('flags invalid emails and missing fields', () => {
    const result = validateRecipientRows([
      { rowNumber: 2, name: 'A', email: 'not-an-email', topic: 'T', paper: 'P' },
      { rowNumber: 3, name: '', email: 'a@example.com', topic: 'T', paper: 'P' },
    ]);
    expect(result.valid).toHaveLength(0);
    expect(result.invalidRows).toHaveLength(2);
    expect(result.invalidRows[0]?.reason).toMatch(/email/i);
    expect(result.invalidRows[1]?.reason).toMatch(/Name/i);
  });

  it('detects duplicates in the batch and against existing emails', () => {
    const result = validateRecipientRows(
      [
        { rowNumber: 2, name: 'A', email: 'dup@example.com', topic: 'T', paper: 'P' },
        { rowNumber: 3, name: 'B', email: 'dup@example.com', topic: 'T', paper: 'P' },
        { rowNumber: 4, name: 'C', email: 'old@example.com', topic: 'T', paper: 'P' },
      ],
      new Set(['old@example.com']),
    );
    expect(result.valid).toHaveLength(1);
    expect(result.duplicateCount).toBe(2);
    expect(result.invalidRows.map((row) => row.reason)).toEqual([
      'Duplicate email',
      'Duplicate email',
    ]);
  });
});
