import { describe, expect, it } from 'vitest';
import { renderEmailTemplate } from './email-render.js';
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
      const haystack = [template.subject, template.bodyHtml, template.bodyText]
        .join('\n')
        .replaceAll('app.fresi.org', '');
      expect(haystack, template.key).not.toMatch(PRODUCT_NAMES);
    }
  });

  it('does not describe a product UI', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      const haystack = [template.subject, template.bodyHtml, template.bodyText]
        .join('\n')
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/\{\{\w+Url\}\}/g, '')
        .replace(/the dashboard may appear empty at first/gi, '');
      expect(haystack, template.key).not.toMatch(PRODUCT_UI);
    }
  });

  it('uses the shared card layout', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      expect(template.bodyHtml, template.key).toContain('max-width:600px');
      expect(template.bodyHtml, template.key).toContain('border-radius:10px');
      expect(template.bodyHtml, template.key).toContain('width=device-width');
      // The contact address is filled in when the email is sent, never baked in.
      expect(template.bodyHtml, template.key).toContain(
        'This is a system generated mail. For any queries contact: {{contactEmail}}',
      );
      expect(template.bodyText, template.key).toContain('contact: {{contactEmail}}');
      expect(template.variables, template.key).toContain('contactEmail');
      expect(template.bodyHtml, template.key).not.toMatch(/@fresi\.org/);
    }
  });

  it('declares every variable it uses', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      const used = [template.subject, template.bodyHtml, template.bodyText]
        .join('\n')
        .matchAll(/\{\{(\w+)\}\}/g);
      for (const match of used) {
        expect(template.variables, `${template.key} uses ${match[1]}`).toContain(match[1]);
      }
    }
  });

  it('names the paper in every subject about a paper', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      // A draft may still be untitled, so its reminder names the conference instead.
      if (!template.variables.includes('paperTitle') || template.key === 'draft.reminder') continue;
      expect(template.subject, template.key).toMatch(/\{\{(paperTitle|submissionNumber)\}\}/);
    }
  });

  it('gives the reader a link wherever it asks them to act', () => {
    for (const key of [
      'decision.notified',
      'review.released',
      'cameraready.reminder',
      'registration.early_bird_ending',
      'registration.deadline_reminder',
      'registration.clarification_requested',
      'registration.additional_payment_required',
      'registration.student_rate_rejected',
      'registration.discarded',
      'submission.confirmed',
      'paper.withdrawn',
    ]) {
      const template = PLATFORM_NOTIFICATION_TEMPLATES.find((row) => row.key === key);
      expect(template?.bodyHtml, key).toMatch(/<a href="\{\{(paperUrl|registrationUrl)\}\}"/);
    }
  });

  it('tells the author why a student rate was refused', () => {
    for (const key of [
      'registration.student_rate_rejected',
      'registration.additional_payment_required',
    ]) {
      const template = PLATFORM_NOTIFICATION_TEMPLATES.find((row) => row.key === key);
      expect(template?.bodyHtml, key).toContain('{{reason}}');
      expect(template?.bodyText, key).toContain('Reason: {{reason}}');
    }
  });

  it('uses one label for the paper code and one spelling', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      const body = [template.subject, template.bodyText].join('\n');
      expect(body, template.key).not.toMatch(/PaperID|Submission code|\bSubmission: /);
      expect(body, template.key).not.toMatch(/organiz|\bprogram\b/i);
    }
  });

  it('greets reviewers as Dr. and authors by the name they entered', () => {
    const body = (key: string) =>
      PLATFORM_NOTIFICATION_TEMPLATES.find((row) => row.key === key)!.bodyText;
    for (const key of ['assignment.notified', 'review.reminder', 'review.thank_you']) {
      expect(body(key), key).toContain('Dear Dr. {{reviewerName}},');
    }
    for (const key of ['decision.accepted', 'decision.notified']) {
      expect(body(key), key).toContain('Dear {{authorName}},');
    }
  });

  it('carries the committee note in the acceptance letter only when there is one', () => {
    const template = PLATFORM_NOTIFICATION_TEMPLATES.find(
      (row) => row.key === 'decision.accepted',
    )!;
    const context = {
      authorName: 'Mira Sharma',
      conferenceName: 'Example Conference 2026',
      submissionNumber: 'EXC2026-K7Q4',
      paperTitle: 'Graph neural routing',
      registrationUrl: 'https://app.example.org/r',
      contactEmail: 'help@example.org',
    };
    const note = 'Committee note: Please shorten section 3.';
    for (const mode of ['html', 'text'] as const) {
      const source = mode === 'html' ? template.bodyHtml : template.bodyText;
      expect(renderEmailTemplate(source, { ...context, rationaleBlock: note }, mode)).toContain(
        note,
      );
      const without = renderEmailTemplate(source, { ...context, rationaleBlock: '' }, mode);
      expect(without).not.toContain('Committee note');
      expect(without).not.toMatch(mode === 'html' ? /<p\b[^>]*>\s*<\/p>/ : /\n{3,}/);
    }
  });

  it('no longer ships the registration-open email nothing sends', () => {
    expect(
      PLATFORM_NOTIFICATION_TEMPLATES.some((row) => row.key === 'registration.window_open'),
    ).toBe(false);
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

  it('includes a confidentiality note on assignment.notified', () => {
    const template = PLATFORM_NOTIFICATION_TEMPLATES.find(
      (row) => row.key === 'assignment.notified',
    );
    const note =
      'This manuscript is confidential and is shared with you only for review. Please do not copy, forward, or discuss it with anyone outside the review, and do not use its unpublished ideas in your own work. Kindly review the file as received, without altering it.';
    expect(template?.bodyHtml).toContain(note);
    expect(template?.bodyText).toContain(note);
  });

  it('uses the effective deadline and review link in assignment and reminder emails', () => {
    for (const key of ['assignment.notified', 'review.reminder']) {
      const template = PLATFORM_NOTIFICATION_TEMPLATES.find((row) => row.key === key);
      expect(template?.bodyHtml).toContain('{{dueAt}}');
      expect(template?.bodyText).toContain('{{dueAt}}');
      expect(template?.bodyHtml).toContain('{{reviewUrl}}');
      expect(template?.variables).toEqual(expect.arrayContaining(['dueAt', 'reviewUrl']));
      expect(template?.bodyText).not.toContain('within 7 days');
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
    expect(template?.bodyHtml).toContain('Dear Professor,');
    // Only the invitation calls its steps "How to accept".
    expect(
      PLATFORM_NOTIFICATION_TEMPLATES.filter((row) => row.bodyHtml.includes('How to accept')),
    ).toHaveLength(1);
    expect(template?.bodyHtml).toContain(
      'the dashboard may appear empty at first. Please wait until a paper is assigned to you.',
    );
    expect(template?.bodyText).toContain('1. Open the invitation link below.');
  });

  it('thanks the reviewer after a review is submitted', () => {
    const template = PLATFORM_NOTIFICATION_TEMPLATES.find((row) => row.key === 'review.thank_you');
    expect(template?.subject).toContain('Thank you for your review');
    expect(template?.bodyHtml).toContain('Thank you for submitting your review');
    expect(template?.variables).toEqual(
      expect.arrayContaining(['reviewerName', 'paperTitle', 'conferenceName', 'submissionNumber']),
    );
  });

  it('white-labels conference mail with conferenceName', () => {
    for (const template of PLATFORM_NOTIFICATION_TEMPLATES) {
      if (template.key.startsWith('auth.')) {
        expect(template.variables, template.key).not.toContain('conferenceName');
        expect(template.bodyHtml, template.key).not.toContain('{{conferenceName}}');
        expect(template.bodyText, template.key).toContain('This is an automated message.');
        // A contact address follows, so the email must not also say not to reply.
        expect(template.bodyText, template.key).not.toContain('do not reply');
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
