import { describe, expect, it } from 'vitest';
import { PLATFORM_NOTIFICATION_TEMPLATES } from './notification-templates.js';

const PRODUCT_NAMES = /OpenConferences|FresiCMT|\bFresi\b/i;

describe('platform notification templates', () => {
  it('never names the product', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      const haystack = [template.subject, template.bodyHtml, template.bodyText].join('\n');
      expect(haystack, template.key).not.toMatch(PRODUCT_NAMES);
    }
  });

  it('white-labels conference mail with conferenceName', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      if (template.key.startsWith('auth.')) {
        expect(template.variables, template.key).not.toContain('conferenceName');
        expect(template.bodyHtml, template.key).not.toContain('{{conferenceName}}');
        continue;
      }

      expect(template.variables, template.key).toContain('conferenceName');
      expect(template.bodyHtml, template.key).toContain('{{conferenceName}}');
    }
  });
});
