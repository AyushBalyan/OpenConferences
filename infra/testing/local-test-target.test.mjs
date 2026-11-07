import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertLocalDatabaseUrl,
  assertLocalRedisUrl,
  assertTestMarker,
} from './local-test-target.mjs';
test('accepts explicit local disposable test targets', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]'])
    assert.doesNotThrow(() =>
      assertLocalDatabaseUrl(`postgresql://test:synthetic@${host}:55451/app_test`),
    );
  assert.doesNotThrow(() =>
    assertLocalDatabaseUrl('postgresql://test@127.0.0.1/bot_api_test_ci', {
      prefix: 'bot_api_test_',
    }),
  );
  assert.doesNotThrow(() => assertLocalRedisUrl('redis://127.0.0.1:6387/15'));
  assert.doesNotThrow(() => assertTestMarker('reviewer-security-test'));
});
test('rejects missing, remote, deceptive and non-test database targets without echoing credentials', () => {
  for (const value of [
    undefined,
    'not-a-url',
    'postgresql://test:private-password@remote.example/app_test',
    'postgresql://test@localhost.evil.test/app_test',
    'postgresql://test@127.0.0.1/production',
    'postgresql://test@127.0.0.1/app_test?host=remote.example',
    'postgresql://test@127.0.0.1/app_test?hostaddr=203.0.113.1',
    'postgresql://test@127.0.0.1/app_test?dbname=production',
    'postgresql://test@127.0.0.1/app_test?options=unsafe',
    'postgresql://test@127.0.0.1/app_test#fragment',
  ]) {
    assert.throws(
      () => assertLocalDatabaseUrl(value),
      (error) => error instanceof Error && !error.message.includes('private-password'),
    );
  }
});
test('rejects remote Redis and invalid markers', () => {
  for (const value of [
    undefined,
    'redis://remote.example:6379',
    'redis://localhost:6379?host=remote.example',
  ])
    assert.throws(() => assertLocalRedisUrl(value));
  assert.throws(() => assertTestMarker(''));
});
