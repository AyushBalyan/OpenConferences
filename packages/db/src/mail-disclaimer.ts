const DISCLAIMER_LEAD = 'This is a system generated mail. For any queries contact:';

/** The closing line of every email, naming where questions should go. */
export function mailDisclaimer(contactEmail: string): string {
  return `${DISCLAIMER_LEAD} ${contactEmail}`;
}

/** Add the closing line to mail that does not already end with one. */
export function withMailDisclaimer(
  content: string,
  format: 'html' | 'text',
  contactEmail: string,
): string {
  if (content.includes(DISCLAIMER_LEAD)) return content;
  const line = mailDisclaimer(contactEmail);
  if (format === 'html') {
    return `${content}\n<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;">${line}</p>`;
  }
  return `${content}\n\n${line}`;
}
