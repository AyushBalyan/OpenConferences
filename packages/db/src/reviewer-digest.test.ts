import { describe, it, expect } from 'vitest';
import { renderReviewerDigest } from './reviewer-digest.js';
const data = {
  conferenceName: '<script>conference</script>',
  reviewerName: 'A & B',
  reviewUrl: 'https://example.test/reviews?a=1&b=2',
  items: [
    {
      id: 'id',
      version: 0,
      paperId: 'p',
      roundId: 'r',
      paperTitle: '<img src=x onerror=alert(1)>',
      submissionNumber: 'SYS-001',
      roundNumber: 2,
      dueAt: '2026-10-11T10:30:00.000Z',
      overdue: true,
    },
  ],
};
describe('digest email rendering', () => {
  it('escapes untrusted text and includes an explicit individual deadline and UTC', () => {
    const rendered = renderReviewerDigest(
      {
        subject: '{{conferenceName}}\nreview',
        bodyHtml: '<p>{{reviewerName}}</p>{{reviewItems}}<a href="{{reviewUrl}}">Review</a>',
        bodyText: '{{reviewItems}}',
      },
      data,
    );
    expect(rendered.html).not.toContain('<img');
    expect(rendered.html).toContain('&lt;img');
    expect(rendered.html).toContain('A &amp; B');
    expect(rendered.html).toContain('11 Oct 2026, 10:30 UTC');
    expect(rendered.text).toContain('Cycle 2');
    expect(rendered.subject).not.toContain('\n');
  });
  it('always includes assignments even when a custom template omits the list', () => {
    const rendered = renderReviewerDigest(
      { subject: 'Reminder', bodyHtml: '<body>Hello</body>', bodyText: 'Hello' },
      data,
    );
    expect(rendered.html).toContain('SYS-001');
    expect(rendered.text).toContain('SYS-001');
  });
  it('does not interpret reserved tokens inside untrusted reviewer names', () => {
    const rendered = renderReviewerDigest(
      {
        subject: 'Reminder',
        bodyHtml: '<p>{{reviewerName}}</p>{{reviewItems}}',
        bodyText: '{{reviewerName}}\n{{reviewItems}}',
      },
      { ...data, reviewerName: '{{reviewItems}}' },
    );
    expect(rendered.html).toContain('<p>{{reviewItems}}</p>');
    expect(rendered.html.split('SYS-001')).toHaveLength(2);
  });
  it('rejects an unsafe review URL', () =>
    expect(() =>
      renderReviewerDigest(
        { subject: 'x', bodyHtml: 'x', bodyText: 'x' },
        { ...data, reviewUrl: 'javascript:alert(1)' },
      ),
    ).toThrow());
});
