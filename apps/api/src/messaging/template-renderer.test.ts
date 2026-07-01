import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  extractTemplateVariables,
  renderTemplate,
  validateTemplateVariables,
} from './template-renderer';

describe('template-renderer', () => {
  it('escapes HTML in template variables', () => {
    const rendered = renderTemplate('<p>{{name}}</p>', {
      name: '<script>alert(1)</script>',
    });
    expect(rendered).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  it('renders missing variables as empty string', () => {
    expect(renderTemplate('Hello {{name}}', {})).toBe('Hello ');
  });

  it('extracts template variables', () => {
    expect(extractTemplateVariables('{{a}} and {{b}}')).toEqual(['a', 'b']);
  });

  it('validates declared variables', () => {
    expect(() => validateTemplateVariables(['a'], '{{a}} {{b}}', 'ok')).toThrow(
      'undeclared variable: b',
    );
  });

  it('escapeHtml handles ampersands', () => {
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });
});
