import { beforeEach, describe, expect, it, vi } from 'vitest';

const getConfigMock = vi.fn();

vi.mock('@openconferences/config/env', () => ({
  getConfig: () => getConfigMock(),
}));

import { NotificationPublisher } from './notification.publisher';

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
