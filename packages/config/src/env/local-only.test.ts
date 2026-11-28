import { describe, expect, it } from 'vitest';
import { getConfig, resetConfig } from './index.js';
import {
  assertLocalDatabaseUrl,
  assertLocalDatabaseUrlIfSet,
  NonLocalDatabaseError,
} from './local-only.js';

const REMOTE_URL =
  'postgresql://app_user:s3cret-value@db.example.invalid:5432/postgres?sslmode=require';

describe('assertLocalDatabaseUrl', () => {
  it.each([
    'postgresql://openconferences@127.0.0.1:55433/openconferences_redesign',
    'postgresql://openconferences:openconferences@localhost:5432/openconferences_test',
    'postgres://openconferences@[::1]:5432/openconferences_redesign',
    'postgresql://openconferences@localhost/openconferences_redesign?schema=public&connect_timeout=15',
  ])('accepts the loopback URL %s', (url) => {
    expect(() => assertLocalDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    ['a hosted database', REMOTE_URL],
    ['a private network address', 'postgresql://user@10.0.0.12:5432/openconferences'],
    ['every interface', 'postgresql://user@0.0.0.0:5432/openconferences'],
    ['a compose service name', 'postgresql://user@postgres:5432/openconferences'],
    ['a lookalike host', 'postgresql://user@localhost.example.invalid:5432/openconferences'],
    ['a URL with no host', 'postgresql:///openconferences'],
  ])('refuses %s', (_label, url) => {
    expect(() => assertLocalDatabaseUrl(url)).toThrow(NonLocalDatabaseError);
  });

  it.each(['host', 'hostaddr', 'service', 'options'])(
    'refuses a local URL that overrides the server with "%s"',
    (option) => {
      const url = `postgresql://user@localhost:5432/openconferences?${option}=db.example.invalid`;
      expect(() => assertLocalDatabaseUrl(url)).toThrow(
        new RegExp(`connection option "${option}"`),
      );
    },
  );

  it.each([
    ['unset', undefined],
    ['blank', '   '],
    ['not a URL', 'not a url'],
    ['another protocol', 'mysql://user@localhost:3306/openconferences'],
  ])('refuses a value that is %s', (_label, value) => {
    expect(() => assertLocalDatabaseUrl(value)).toThrow(NonLocalDatabaseError);
  });

  it('explains what happened and what to do, without leaking the URL', () => {
    let message = '';
    try {
      assertLocalDatabaseUrl(REMOTE_URL);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('Refusing to start');
    expect(message).toContain('DATABASE_URL points at "db.example.invalid"');
    expect(message).toContain('not a local database');
    expect(message).toContain('pnpm redesign:dev');
    expect(message).not.toContain('s3cret-value');
    expect(message).not.toContain('app_user');
  });

  it('names the variable it was asked to check', () => {
    expect(() => assertLocalDatabaseUrl(REMOTE_URL, 'OWNER_DATABASE_URL')).toThrow(
      /OWNER_DATABASE_URL points at/,
    );
  });
});

describe('assertLocalDatabaseUrlIfSet', () => {
  it('passes when the variable is unset or blank', () => {
    expect(() => assertLocalDatabaseUrlIfSet(undefined)).not.toThrow();
    expect(() => assertLocalDatabaseUrlIfSet('')).not.toThrow();
  });

  it('still refuses a non-local URL', () => {
    expect(() => assertLocalDatabaseUrlIfSet(REMOTE_URL)).toThrow(NonLocalDatabaseError);
  });
});

describe('getConfig on the redesign branch', () => {
  const baseEnv = {
    NODE_ENV: 'development',
    REDIS_URL: 'redis://127.0.0.1:6379/7',
    S3_ENDPOINT: 'http://127.0.0.1:9000',
    S3_ACCESS_KEY: 'minioadmin',
    S3_SECRET_KEY: 'minioadmin',
    S3_BUCKET: 'openconferences-redesign',
    BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long-for-ci',
  };

  it('loads a configuration that uses the local redesign database', () => {
    resetConfig();
    const config = getConfig({
      ...baseEnv,
      DATABASE_URL: 'postgresql://openconferences@127.0.0.1:55433/openconferences_redesign',
    });
    expect(new URL(config.databaseUrl).hostname).toBe('127.0.0.1');
  });

  it.each(['development', 'test', 'production'])(
    'refuses a non-local database when NODE_ENV is %s',
    (nodeEnv) => {
      resetConfig();
      expect(() => getConfig({ ...baseEnv, NODE_ENV: nodeEnv, DATABASE_URL: REMOTE_URL })).toThrow(
        NonLocalDatabaseError,
      );
    },
  );

  it('offers no environment switch that skips the check', () => {
    resetConfig();
    expect(() =>
      getConfig({
        ...baseEnv,
        DATABASE_URL: REMOTE_URL,
        SKIP_ENV_FILE: 'true',
        SKIP_DB_ROLE_CHECK: 'true',
        ALLOW_REMOTE_DATABASE: 'true',
        S3_ALLOW_REMOTE: 'true',
      }),
    ).toThrow(NonLocalDatabaseError);
  });
});
