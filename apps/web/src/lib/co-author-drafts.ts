export type CoAuthorDraft = {
  key: string;
  authorshipId: string | null;
  fullName: string;
  email: string;
  affiliation: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 255;
const EMAIL_MAX = 255;
const AFFILIATION_MAX = 500;

export function emptyCoAuthorDraft(): CoAuthorDraft {
  return {
    key: crypto.randomUUID(),
    authorshipId: null,
    fullName: '',
    email: '',
    affiliation: '',
  };
}

export function isBlankCoAuthor(row: CoAuthorDraft): boolean {
  return !row.fullName.trim() && !row.email.trim() && !row.affiliation.trim();
}

export type CoAuthorToSave = {
  key: string;
  fullName: string;
  email: string;
  affiliation?: string;
};

export type CoAuthorValidation =
  | { ok: true; errors: Record<string, string>; toSave: CoAuthorToSave[] }
  | { ok: false; errors: Record<string, string>; toSave: CoAuthorToSave[] };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateCoAuthorDrafts(
  rows: CoAuthorDraft[],
  takenEmails: string[],
): CoAuthorValidation {
  const errors: Record<string, string> = {};
  const seen = new Set(takenEmails.map(normalizeEmail).filter(Boolean));
  const toSave: CoAuthorToSave[] = [];

  for (const row of rows) {
    if (row.authorshipId) {
      const email = normalizeEmail(row.email);
      if (email) seen.add(email);
      continue;
    }

    if (isBlankCoAuthor(row)) continue;

    const fullName = row.fullName.trim();
    const email = row.email.trim();
    const affiliation = row.affiliation.trim();

    if (!fullName || !email) {
      errors[row.key] = 'Enter a full name and email, or remove this co-author.';
      continue;
    }
    if (fullName.length > NAME_MAX) {
      errors[row.key] = 'Name must be 255 characters or fewer.';
      continue;
    }
    if (email.length > EMAIL_MAX || !EMAIL_PATTERN.test(email)) {
      errors[row.key] = 'Enter a valid email address.';
      continue;
    }
    if (affiliation.length > AFFILIATION_MAX) {
      errors[row.key] = 'Affiliation must be 500 characters or fewer.';
      continue;
    }

    const normalized = normalizeEmail(email);
    if (seen.has(normalized)) {
      errors[row.key] = 'This email is already on the author list.';
      continue;
    }

    seen.add(normalized);
    toSave.push({
      key: row.key,
      fullName,
      email,
      ...(affiliation ? { affiliation } : {}),
    });
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    toSave,
  };
}
