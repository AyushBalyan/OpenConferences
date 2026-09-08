import { describe, expect, it } from 'vitest';
import { getConfig, resetConfig } from './index.js';

describe('getConfig', () => {
  it('parses valid environment and returns typed config', () => {
    resetConfig();
    const config = getConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/openconferences_test',
      REDIS_URL: 'redis://localhost:6379',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
      S3_BUCKET: 'openconferences',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-ci',
      MAIL_FROM: 'noreply@example.com',
    });

    expect(config.nodeEnv).toBe('test');
    expect(config.isTest).toBe(true);
    expect(config.s3.bucket).toBe('openconferences');
    expect(config.api.basePath).toBe('/api/v1');
    expect(config.mail.submissionAlertEmail).toBeUndefined();
  });

  it('accepts an optional SUBMISSION_ALERT_EMAIL', () => {
    resetConfig();
    const config = getConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/openconferences_test',
      REDIS_URL: 'redis://localhost:6379',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
      S3_BUCKET: 'openconferences',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-ci',
      MAIL_FROM: 'noreply@example.com',
      SUBMISSION_ALERT_EMAIL: 'ops@example.com',
    });
    expect(config.mail.submissionAlertEmail).toBe('ops@example.com');
  });

  it('treats a blank SUBMISSION_ALERT_EMAIL as unset', () => {
    resetConfig();
    const config = getConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/openconferences_test',
      REDIS_URL: 'redis://localhost:6379',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
      S3_BUCKET: 'openconferences',
      BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-ci',
      MAIL_FROM: 'noreply@example.com',
      SUBMISSION_ALERT_EMAIL: '   ',
    });
    expect(config.mail.submissionAlertEmail).toBeUndefined();
  });

  it('rejects an invalid SUBMISSION_ALERT_EMAIL', () => {
    resetConfig();
    expect(() =>
      getConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/openconferences_test',
        REDIS_URL: 'redis://localhost:6379',
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY: 'minioadmin',
        S3_SECRET_KEY: 'minioadmin',
        S3_BUCKET: 'openconferences',
        BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-ci',
        MAIL_FROM: 'noreply@example.com',
        SUBMISSION_ALERT_EMAIL: 'not-an-email',
      }),
    ).toThrow(/SUBMISSION_ALERT_EMAIL/);
  });

  it('throws on missing required variables', () => {
    resetConfig();
    expect(() =>
      getConfig({
        NODE_ENV: 'test',
      }),
    ).toThrow(/Invalid environment configuration/);
  });
});
