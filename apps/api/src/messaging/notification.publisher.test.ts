import { beforeEach, describe, expect, it, vi } from 'vitest';

const getConfigMock = vi.fn();

vi.mock('@openconferences/config/env', () => ({
  getConfig: () => getConfigMock(),
}));

import { NotificationPublisher } from './notification.publisher';
import { PLATFORM_NOTIFICATION_TEMPLATES } from '@openconferences/db';
import { renderTemplate } from './template-renderer';

describe('NotificationPublisher.publishPaperSubmitted', () => {
  const enqueue = vi.fn();
  const publisher = new NotificationPublisher({ enqueue } as never);

  const payload = {
    to: 'author@example.com',
    paperId: 'paper-1',
    paperTitle: 'A Study',
    conferenceName: 'ICAM 2026',
    conferenceId: 'conf-1',
    organizationId: 'org-1',
    authorEmail: 'author@example.com',
    idempotencyKey: 'submission-confirmed-paper-1',
  };

  beforeEach(() => {
    enqueue.mockReset();
    enqueue.mockResolvedValue('log-1');
    getConfigMock.mockReset();
  });

  it('enqueues only the author confirmation when ops email is unset', async () => {
    getConfigMock.mockReturnValue({ mail: {}, webUrl: 'http://localhost:3000' });

    await publisher.publishPaperSubmitted(payload);

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]?.[0]).toMatchObject({
      templateKey: 'submission.confirmed',
      to: 'author@example.com',
      context: {
        paperTitle: 'A Study',
        conferenceName: 'ICAM 2026',
        authorName: '',
        authorEmail: 'author@example.com',
        authorAffiliation: '—',
        authorList: '',
      },
    });
  });

  it('enqueues an ops alert when SUBMISSION_ALERT_EMAIL is set', async () => {
    getConfigMock.mockReturnValue({
      mail: { submissionAlertEmail: 'ops@example.com' },
      webUrl: 'http://localhost:3000/',
    });

    await publisher.publishPaperSubmitted(payload);

    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[1]?.[0]).toMatchObject({
      templateKey: 'submission.ops_alert',
      to: 'ops@example.com',
      idempotencyKey: 'submission-ops-alert-paper-1',
      context: {
        paperTitle: 'A Study',
        conferenceName: 'ICAM 2026',
        authorEmail: 'author@example.com',
        paperUrl: 'http://localhost:3000/dashboard/conferences/conf-1/submissions/paper-1',
      },
    });
  });

  it('skips the ops alert when it would email the corresponding author', async () => {
    getConfigMock.mockReturnValue({
      mail: { submissionAlertEmail: 'AUTHOR@example.com' },
      webUrl: 'http://localhost:3000',
    });

    await publisher.publishPaperSubmitted(payload);

    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0]?.[0].templateKey).toBe('submission.confirmed');
  });
});

describe('NotificationPublisher.publishPaperWithdrawn', () => {
  const enqueue = vi.fn();
  const publisher = new NotificationPublisher({ enqueue } as never);

  beforeEach(() => {
    enqueue.mockReset();
    enqueue.mockResolvedValue('log-1');
  });

  it('uses a per-recipient idempotency key and the author template', async () => {
    await publisher.publishPaperWithdrawn({
      to: 'author@example.com',
      audience: 'author',
      paperId: 'paper-1',
      paperTitle: 'A Study',
      submissionNumber: 'SUBCONF-K7Q4',
      conferenceName: 'ICAM 2026',
      conferenceId: 'conf-1',
      organizationId: 'org-1',
      reason: 'Submitting elsewhere',
      idempotencyKey: 'paper-withdrawn-paper-1-author@example.com',
    });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'paper.withdrawn',
        idempotencyKey: 'paper-withdrawn-paper-1-author@example.com',
        context: expect.objectContaining({ reason: 'Submitting elsewhere' }),
      }),
    );
  });
});

describe('review coordination notifications', () => {
  const enqueue = vi.fn();
  const publisher = new NotificationPublisher({ enqueue } as never);
  beforeEach(() => {
    enqueue.mockReset();
    enqueue.mockResolvedValue('job-id');
    getConfigMock.mockReturnValue({ webUrl: 'http://localhost:3000/' });
  });
  const payload = {
    to: 'reviewer@example.test',
    conferenceId: 'conference',
    organizationId: 'organization',
    conferenceName: 'Conference',
    paperTitle: 'Paper',
    dueAt: '2030-10-10T10:00:00Z',
    assignmentId: 'assignment',
    idempotencyKey: 'daily-reminder',
  };
  it('provides the effective deadline and conference review link to reminders', async () => {
    expect(await publisher.publishReviewReminder(payload)).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'review.reminder',
        context: expect.objectContaining({
          dueAt: payload.dueAt,
          reviewUrl:
            'http://localhost:3000/dashboard/conferences/conference/reviews/my-assignments',
        }),
        relatedEntityId: 'assignment',
      }),
    );
  });
  it('renders the saved individual deadline in both assignment email formats', async () => {
    await publisher.publishReviewerAssigned({
      ...payload,
      reviewerName: 'Reviewer',
      roundNumber: 2,
    });
    const mail = enqueue.mock.calls[0]![0];
    const template = PLATFORM_NOTIFICATION_TEMPLATES.find((row) => row.key === mail.templateKey)!;
    for (const body of [template.bodyHtml, template.bodyText!]) {
      const rendered = renderTemplate(body, mail.context);
      expect(rendered).toContain(payload.dueAt);
      expect(rendered).toContain(
        'http://localhost:3000/dashboard/conferences/conference/reviews/my-assignments',
      );
      expect(rendered).not.toContain('within 7 days');
      expect(rendered).not.toContain('{{dueAt}}');
    }
  });
  it('reports a suppressed reminder or replacement assignment email honestly', async () => {
    enqueue.mockResolvedValue(null);
    expect(await publisher.publishReviewReminder(payload)).toBe(false);
    expect(
      await publisher.publishReviewerAssigned({
        ...payload,
        reviewerName: 'Reviewer',
        roundNumber: 1,
      }),
    ).toBe(false);
  });
});
