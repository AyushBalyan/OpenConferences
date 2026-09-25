import { describe, expect, it } from 'vitest';
import { escapeHtml, renderOutreachTemplate } from './template-renderer';

describe('renderOutreachTemplate', () => {
  it('substitutes name, topic, and paper', () => {
    const html = renderOutreachTemplate('Dear {{name}}, expertise in {{topic}} from {{paper}}.', {
      name: 'Dr. Jane',
      topic: 'AI',
      paper: 'Advances in ML',
    });
    expect(html).toBe('Dear Dr. Jane, expertise in AI from Advances in ML.');
  });

  it('treats {{paper title}} as {{paper}}', () => {
    const html = renderOutreachTemplate('Paper: {{paper title}}', { paper: 'My Title' });
    expect(html).toBe('Paper: My Title');
  });

  it('HTML-escapes merge values', () => {
    const html = renderOutreachTemplate('<p>{{name}}</p>', { name: '<script>x</script>' });
    expect(html).toBe('<p>&lt;script&gt;x&lt;/script&gt;</p>');
    expect(escapeHtml('<img>')).toBe('&lt;img&gt;');
  });

  it('replaces unknown variables with empty string', () => {
    expect(renderOutreachTemplate('Hi {{unknown}}', { name: 'A' })).toBe('Hi ');
  });
});
