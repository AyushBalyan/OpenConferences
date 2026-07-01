import { describe, expect, it } from 'vitest';
import { escapeHtml, renderTemplate } from './template-renderer';

describe('notification idempotency semantics', () => {
  it('renders stable output for duplicate context (idempotent render)', () => {
    const context = { paperTitle: 'Test Paper' };
    const first = renderTemplate('Confirmed: {{paperTitle}}', context);
    const second = renderTemplate('Confirmed: {{paperTitle}}', context);
    expect(first).toBe(second);
    expect(first).toBe('Confirmed: Test Paper');
  });

  it('escapes injection attempts in idempotent render path', () => {
    const rendered = renderTemplate('{{paperTitle}}', {
      paperTitle: '<img src=x onerror=alert(1)>',
    });
    expect(rendered).not.toContain('<img');
    expect(rendered).toContain(escapeHtml('<img src=x onerror=alert(1)>'));
  });
});
