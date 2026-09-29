import { describe, expect, it } from 'vitest';
import { type CoAuthorDraft, isBlankCoAuthor, validateCoAuthorDrafts } from './co-author-drafts';

function draft(overrides: Partial<CoAuthorDraft> = {}): CoAuthorDraft {
  return {
    key: 'row-1',
    authorshipId: null,
    fullName: '',
    email: '',
    affiliation: '',
    ...overrides,
  };
}

describe('validateCoAuthorDrafts', () => {
  it('skips blank rows', () => {
    const row = draft();
    expect(isBlankCoAuthor(row)).toBe(true);
    expect(validateCoAuthorDrafts([row], [])).toEqual({
      ok: true,
      errors: {},
      toSave: [],
    });
  });

  it('collects every complete co-author', () => {
    const result = validateCoAuthorDrafts(
      [
        draft({ key: 'a', fullName: 'Ada Lovelace', email: 'ada@example.edu' }),
        draft({
          key: 'b',
          fullName: 'Grace Hopper',
          email: 'grace@example.edu',
          affiliation: 'Navy',
        }),
        draft({ key: 'blank' }),
      ],
      [],
    );

    expect(result.ok).toBe(true);
    expect(result.toSave).toEqual([
      { key: 'a', fullName: 'Ada Lovelace', email: 'ada@example.edu' },
      {
        key: 'b',
        fullName: 'Grace Hopper',
        email: 'grace@example.edu',
        affiliation: 'Navy',
      },
    ]);
  });

  it('rejects a partial row and duplicate emails', () => {
    const result = validateCoAuthorDrafts(
      [
        draft({ key: 'partial', fullName: 'Only Name' }),
        draft({ key: 'dup', fullName: 'Ada Lovelace', email: 'Ada@Example.edu' }),
        draft({
          key: 'saved',
          authorshipId: 'auth-1',
          fullName: 'Saved',
          email: 'saved@example.edu',
        }),
      ],
      ['ada@example.edu'],
    );

    expect(result.ok).toBe(false);
    expect(result.errors.partial).toMatch(/full name and email/i);
    expect(result.errors.dup).toMatch(/already on the author list/i);
    expect(result.errors.saved).toBeUndefined();
    expect(result.toSave).toEqual([]);
  });

  it('rejects an invalid email and an over-long affiliation', () => {
    const result = validateCoAuthorDrafts(
      [
        draft({ key: 'email', fullName: 'Alan Turing', email: 'not-an-email' }),
        draft({
          key: 'affiliation',
          fullName: 'Katherine Johnson',
          email: 'katherine@example.edu',
          affiliation: 'x'.repeat(501),
        }),
      ],
      [],
    );

    expect(result.ok).toBe(false);
    expect(result.errors.email).toMatch(/valid email/i);
    expect(result.errors.affiliation).toMatch(/500 characters/i);
  });
});
