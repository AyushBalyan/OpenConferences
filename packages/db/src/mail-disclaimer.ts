export const MAIL_DISCLAIMER =
  'This is a system generated mail. For any queries contact: icamcds2026@fresi.org';

export function withMailDisclaimer(content: string, format: 'html' | 'text'): string {
  if (content.includes(MAIL_DISCLAIMER)) return content;
  if (format === 'html') {
    return `${content}\n<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;">${MAIL_DISCLAIMER}</p>`;
  }
  return `${content}\n\n${MAIL_DISCLAIMER}`;
}
