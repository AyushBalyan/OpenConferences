import { describe, expect, it } from 'vitest';
import { getConfig, LOCAL_MINIO_S3, resetConfig, resolveStorageBucket } from './index.js';

const baseEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/openconferences_test',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_BUCKET: 'openconferences',
  BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-ci',
  MAIL_FROM: 'noreply@example.com',
};

describe('getConfig', () => {
  it('parses valid environment and returns typed config', () => {
    resetConfig();
    const config = getConfig(baseEnv);

    expect(config.nodeEnv).toBe('test');
    expect(config.isTest).toBe(true);
    expect(config.mail.from).toBe('noreply@example.com');
    expect(config.mail.submissionAlertEmail).toBeUndefined();
  });

  it('accepts an optional SUBMISSION_ALERT_EMAIL', () => {
    resetConfig();
    const config = getConfig({
      ...baseEnv,
      SUBMISSION_ALERT_EMAIL: 'ops@example.com',
    });
    expect(config.mail.submissionAlertEmail).toBe('ops@example.com');
  });

  it('treats a blank SUBMISSION_ALERT_EMAIL as unset', () => {
    resetConfig();
    const config = getConfig({
      ...baseEnv,
      SUBMISSION_ALERT_EMAIL: '   ',
    });
    expect(config.mail.submissionAlertEmail).toBeUndefined();
  });

  it('rejects an invalid SUBMISSION_ALERT_EMAIL', () => {
    resetConfig();
    expect(() =>
      getConfig({
        ...baseEnv,
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

  it('forces MinIO in development when S3 points at a remote host', () => {
    resetConfig();
    const config = getConfig({
      ...baseEnv,
      NODE_ENV: 'development',
      S3_ENDPOINT: 'https://accountid.r2.cloudflarestorage.com',
      S3_ACCESS_KEY: 'prod-access-key',
      S3_SECRET_KEY: 'prod-secret-key',
      S3_BUCKET: 'production-papers',
      S3_REGION: 'auto',
    });

    expect(config.s3).toEqual(LOCAL_MINIO_S3);
    expect(resolveStorageBucket('production-papers', config)).toBe(LOCAL_MINIO_S3.bucket);
  });

  it('keeps remote S3 in development when S3_ALLOW_REMOTE is true', () => {
    resetConfig();
    const config = getConfig({
      ...baseEnv,
      NODE_ENV: 'development',
      S3_ENDPOINT: 'https://accountid.r2.cloudflarestorage.com',
      S3_ACCESS_KEY: 'prod-access-key',
      S3_SECRET_KEY: 'prod-secret-key',
      S3_BUCKET: 'production-papers',
      S3_ALLOW_REMOTE: 'true',
    });

    expect(config.s3.endpoint).toBe('https://accountid.r2.cloudflarestorage.com');
    expect(config.s3.bucket).toBe('production-papers');
    expect(resolveStorageBucket('legacy-bucket', config)).toBe('production-papers');
  });

  it('does not rewrite remote S3 in production', () => {
    resetConfig();
    const config = getConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      S3_ENDPOINT: 'https://accountid.r2.cloudflarestorage.com',
      S3_BUCKET: 'production-papers',
    });

    expect(config.s3.endpoint).toBe('https://accountid.r2.cloudflarestorage.com');
    expect(config.s3.bucket).toBe('production-papers');
    expect(resolveStorageBucket('production-papers', config)).toBe('production-papers');
    expect(resolveStorageBucket('legacy-bucket', config)).toBe('legacy-bucket');
  });
});
