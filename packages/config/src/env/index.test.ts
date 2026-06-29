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
