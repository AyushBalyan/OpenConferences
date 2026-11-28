import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

// A host under the reserved .invalid domain can never resolve, so these tests
// cannot reach a real server even if the guard were removed.
const REMOTE_URL = 'postgresql://app_user:s3cret-value@db.example.invalid:5432/postgres';
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

describe('database client on the redesign branch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('refuses to load when DATABASE_URL is not local', async () => {
    vi.resetModules();
    vi.stubEnv('DATABASE_URL', REMOTE_URL);
    await expect(import('./index.js')).rejects.toThrow(
      /Refusing to start: DATABASE_URL points at "db\.example\.invalid"/,
    );
  });

  it('loads when DATABASE_URL is local', async () => {
    vi.resetModules();
    vi.stubEnv(
      'DATABASE_URL',
      'postgresql://openconferences@127.0.0.1:55433/openconferences_redesign',
    );
    const db = await import('./index.js');
    expect(db.prisma).toBeDefined();
  });
});

describe('migrations on the redesign branch', () => {
  it('stops the Prisma CLI before it connects to a non-local database', () => {
    const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'status'], {
      cwd: packageRoot,
      env: { ...process.env, DATABASE_URL: REMOTE_URL },
      encoding: 'utf8',
      timeout: 60_000,
    });
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).not.toBe(0);
    expect(output).toContain('Refusing to start: DATABASE_URL points at "db.example.invalid"');
    expect(output).toContain('not a local database');
    expect(output).not.toContain('s3cret-value');
    // The CLI never got as far as reading the schema or opening a connection.
    expect(output).not.toContain('Datasource "db"');
  }, 70_000);
});
