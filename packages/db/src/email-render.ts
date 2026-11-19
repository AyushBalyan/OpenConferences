/**
 * Fills notification templates. Shared by the API and the worker so every
 * email is escaped, dated and tidied the same way.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeEmailHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

/** Human-readable date for notification templates (avoids raw ISO in email bodies). */
export function formatEmailDate(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** A value as it should read in an email: timestamps become dates, the rest is text. */
export function emailValue(value: unknown): string {
  if (value instanceof Date) return formatEmailDate(value);
  const text = String(value ?? '');
  if (ISO_TIMESTAMP.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return formatEmailDate(date);
  }
  return text;
}

/**
 * A name without a leading title, for templates that greet with one ("Dear Dr. …"),
 * so a reviewer who typed "Dr. A. Rao" is not addressed as "Dr. Dr. A. Rao".
 */
export function nameWithoutTitle(name: string | null | undefined): string {
  return (name ?? '').trim().replace(/^(?:(?:Dr|Prof|Professor)\.?\s+)+/i, '');
}

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;
/** A paragraph left with nothing in it once its variable turned out blank. */
const EMPTY_PARAGRAPH = /<p\b[^>]*>\s*<\/p>\n?/g;

export type EmailRenderMode = 'html' | 'text' | 'subject';

/**
 * Replace `{{name}}` placeholders. Unknown names render as nothing.
 * - html: values are escaped, line breaks kept, and emptied paragraphs dropped
 * - text: values as written, with runs of blank lines collapsed
 * - subject: one line
 */
export function renderEmailTemplate(
  template: string,
  context: Record<string, unknown>,
  mode: EmailRenderMode,
): string {
  const filled = template.replace(VARIABLE_PATTERN, (_match, key: string) => {
    if (!(key in context)) return '';
    const value = emailValue(context[key]);
    if (mode === 'html') return escapeEmailHtml(value).replace(/\r?\n/g, '<br>');
    if (mode === 'subject') return value.replace(/\s*[\r\n]+\s*/g, ' ');
    return value;
  });
  if (mode === 'html') return filled.replace(EMPTY_PARAGRAPH, '');
  if (mode === 'text') return filled.replace(/\n{3,}/g, '\n\n').trim();
  return filled.trim();
}
