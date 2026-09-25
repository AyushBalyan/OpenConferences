import { outreachRecipientInputSchema } from '@openconferences/schemas';
import type { OutreachInvalidRow, OutreachRawRecipientRow } from '@openconferences/schemas';

export type ValidatedRecipientRow = {
  name: string;
  email: string;
  topic: string;
  paper: string;
  rowNumber: number;
};

export type RecipientImportResult = {
  valid: ValidatedRecipientRow[];
  invalidRows: OutreachInvalidRow[];
  duplicateCount: number;
};

function emptyReason(row: OutreachRawRecipientRow): string | null {
  if (!row.name?.trim()) return 'Name is required';
  if (!row.email?.trim()) return 'Email is required';
  if (!row.topic?.trim()) return 'Topic is required';
  if (!row.paper?.trim()) return 'Paper is required';
  return null;
}

export function validateRecipientRows(
  rows: OutreachRawRecipientRow[],
  existingEmails: Set<string> = new Set(),
): RecipientImportResult {
  const valid: ValidatedRecipientRow[] = [];
  const invalidRows: OutreachInvalidRow[] = [];
  const seen = new Set<string>(existingEmails);
  let duplicateCount = 0;

  for (const row of rows) {
    const missing = emptyReason(row);
    if (missing) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        name: row.name?.trim() || null,
        email: row.email?.trim() || null,
        topic: row.topic?.trim() || null,
        paper: row.paper?.trim() || null,
        reason: missing,
      });
      continue;
    }

    const parsed = outreachRecipientInputSchema.safeParse({
      name: row.name,
      email: row.email,
      topic: row.topic,
      paper: row.paper,
      rowNumber: row.rowNumber,
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      invalidRows.push({
        rowNumber: row.rowNumber,
        name: row.name?.trim() || null,
        email: row.email?.trim() || null,
        topic: row.topic?.trim() || null,
        paper: row.paper?.trim() || null,
        reason: issue?.message ?? 'Invalid row',
      });
      continue;
    }

    const email = parsed.data.email.trim().toLowerCase();
    if (seen.has(email)) {
      duplicateCount += 1;
      invalidRows.push({
        rowNumber: row.rowNumber,
        name: parsed.data.name,
        email,
        topic: parsed.data.topic,
        paper: parsed.data.paper,
        reason: 'Duplicate email',
      });
      continue;
    }

    seen.add(email);
    valid.push({
      name: parsed.data.name.trim(),
      email,
      topic: parsed.data.topic.trim(),
      paper: parsed.data.paper.trim(),
      rowNumber: row.rowNumber,
    });
  }

  return { valid, invalidRows, duplicateCount };
}
