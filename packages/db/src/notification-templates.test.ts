import { describe, expect, it } from 'vitest';
import { PLATFORM_NOTIFICATION_TEMPLATES } from './notification-templates.js';

const PRODUCT_NAMES = /OpenConferences|FresiCMT|\bFresi\b/i;
const PRODUCT_UI = /\bdashboard\b|\bportal\b|\bplatform\b/i;
/** Anything outside the black/white/grey palette. */
const NON_NEUTRAL_COLOR = /#(?!fff|ffffff|000|000000)(?:[0-9a-f]{3}|[0-9a-f]{6})\b/gi;
const NEUTRAL_COLORS = new Set([
  '#18181b',
  '#52525b',
  '#71717a',
  '#a1a1aa',
  '#e4e4e7',
  '#fafafa',
  '#f4f4f5',
]);

describe('platform notification templates', () => {
  it('never names the product', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      const haystack = [template.subject, template.bodyHtml, template.bodyText].join('\n');
      expect(haystack, template.key).not.toMatch(PRODUCT_NAMES);
    }
  });

  it('does not describe a product UI', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      const haystack = [template.subject, template.bodyHtml, template.bodyText]
        .join('\n')
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/\{\{\w+Url\}\}/g, '');
      expect(haystack, template.key).not.toMatch(PRODUCT_UI);
    }
  });

  it('uses the shared card layout', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      expect(template.bodyHtml, template.key).toContain('max-width:600px');
      expect(template.bodyHtml, template.key).toContain('border-radius:10px');
      expect(template.bodyHtml, template.key).toContain('width=device-width');
      expect(template.bodyHtml, template.key).toContain('<h1');
    }
  });

  it('stays on the black, white and grey palette', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      for (const color of template.bodyHtml.match(NON_NEUTRAL_COLOR) ?? []) {
        expect(NEUTRAL_COLORS, `${template.key} uses ${color}`).toContain(color.toLowerCase());
      }
    }
  });

  it('includes author and paper details on submission.confirmed', () => {
    const template = PLATFORM_NOTIFICATION_TEMPLATES.find(
      (row) => row.key === 'submission.confirmed',
    );
    expect(template).toBeTruthy();
    for (const key of ['authorName', 'authorEmail', 'authorAffiliation', 'authorList']) {
      expect(template?.variables, key).toContain(key);
      expect(template?.bodyHtml, key).toContain(`{{${key}}}`);
      expect(template?.bodyText, key).toContain(`{{${key}}}`);
    }
    for (const key of ['trackName', 'keywords', 'abstract']) {
      expect(template?.variables, key).not.toContain(key);
      expect(template?.bodyHtml, key).not.toContain(`{{${key}}}`);
    }
  });

  it('includes simple accept steps on reviewer.invitation', () => {
    const template = PLATFORM_NOTIFICATION_TEMPLATES.find(
      (row) => row.key === 'reviewer.invitation',
    );
    expect(template).toBeTruthy();
    expect(template?.bodyHtml).toContain('How to accept');
    expect(template?.bodyHtml).toContain('Open the invitation link below.');
    expect(template?.bodyHtml).toContain('choose a name and password');
    expect(template?.bodyHtml).toContain('bid on papers');
    expect(template?.bodyText).toContain('1. Open the invitation link below.');
  });

  it('white-labels conference mail with conferenceName', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      if (template.key.startsWith('auth.')) {
        expect(template.variables, template.key).not.toContain('conferenceName');
        expect(template.bodyHtml, template.key).not.toContain('{{conferenceName}}');
        expect(template.bodyText, template.key).toContain(
          'This is an automated message. Please do not reply.',
        );
        continue;
      }

      expect(template.variables, template.key).toContain('conferenceName');
      expect(template.bodyHtml, template.key).toContain('{{conferenceName}}');
      expect(template.bodyText, template.key).toContain(
        'This message was sent by {{conferenceName}}.',
      );
    }
  });
});
