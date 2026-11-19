import { describe, expect, it } from 'vitest';
import { emailValue, nameWithoutTitle, renderEmailTemplate } from './email-render.js';

describe('email rendering', () => {
  it('turns timestamps into readable dates and leaves other text alone', () => {
    expect(emailValue('2026-12-01T18:29:59.000Z')).toBe('December 1, 2026 at 6:29 PM UTC');
    expect(emailValue(new Date('2026-12-01T18:29:59.000Z'))).toBe(
      'December 1, 2026 at 6:29 PM UTC',
    );
    expect(emailValue('TBD')).toBe('TBD');
    expect(emailValue('Results for 2026-12-01T18:29:59.000Z and after')).toBe(
      'Results for 2026-12-01T18:29:59.000Z and after',
    );
    expect(emailValue(null)).toBe('');
  });

  it('escapes values in HTML and keeps their line breaks', () => {
    expect(
      renderEmailTemplate('<p>{{note}}</p>', { note: 'First <b>line</b>\nSecond & last' }, 'html'),
    ).toBe('<p>First &lt;b&gt;line&lt;/b&gt;<br>Second &amp; last</p>');
  });

  it('drops a paragraph whose value is blank', () => {
    const html = renderEmailTemplate(
      '<p style="margin:0">{{note}}</p>\n<p style="margin:0">{{next}}</p>',
      { note: '', next: 'Thank you.' },
      'html',
    );
    expect(html).toBe('<p style="margin:0">Thank you.</p>');
  });

  it('does not escape plain text or subjects, and keeps a subject on one line', () => {
    const context = { title: 'Graphs & "trees"\nPart 2', dueAt: '2026-12-01T18:29:59.000Z' };
    expect(renderEmailTemplate('Review: {{title}}', context, 'subject')).toBe(
      'Review: Graphs & "trees" Part 2',
    );
    expect(renderEmailTemplate('Due {{dueAt}}\n\n\n\n{{title}}', context, 'text')).toBe(
      'Due December 1, 2026 at 6:29 PM UTC\n\nGraphs & "trees"\nPart 2',
    );
  });

  it('drops a leading title from a name so a greeting does not repeat it', () => {
    expect(nameWithoutTitle('Dr. Arun Mehta')).toBe('Arun Mehta');
    expect(nameWithoutTitle('prof Dr Arun Mehta')).toBe('Arun Mehta');
    expect(nameWithoutTitle('  Professor Arun Mehta ')).toBe('Arun Mehta');
    expect(nameWithoutTitle('Drew Mehta')).toBe('Drew Mehta');
    expect(nameWithoutTitle(null)).toBe('');
  });

  it('renders an unknown variable as nothing', () => {
    expect(renderEmailTemplate('A {{missing}} B', {}, 'text')).toBe('A  B');
  });
});
