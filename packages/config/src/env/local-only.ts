/**
 * Redesign guard: the `redesign` branch may only talk to a local Postgres.
 *
 * `main` is the live product and its environment points at production. Code on
 * `redesign` carries migrations production has not seen, so a non-local
 * DATABASE_URL must stop the process before anything connects.
 *
 * There is deliberately no switch that turns this off. It is removed as part
 * of the cutover (docs/redesign/DECISIONS.md, D10).
 *
 * This file has no imports so that tooling which runs before the workspace is
 * built (the Prisma config, shell helpers) can load it directly.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

/**
 * Connection options that cannot redirect the connection to another server.
 * Anything else is refused, because options such as `host` override the host
 * written in the URL.
 */
const SAFE_OPTIONS = new Set([
  'schema',
  'connection_limit',
  'pool_timeout',
  'connect_timeout',
  'socket_timeout',
  'statement_cache_size',
  'application_name',
  'pgbouncer',
  'sslmode',
  'uselibpqcompat',
]);

const HELP = [
  'The redesign branch only runs against a local Postgres (localhost, 127.0.0.1 or ::1).',
  'Start it with `pnpm redesign:dev`, which uses .env.redesign, and check that the',
  'variable is not exported in your shell. See docs/redesign/GROUND_RULES.md, rule 1.4.',
].join('\n');

export class NonLocalDatabaseError extends Error {
  constructor(reason: string) {
    super(`Refusing to start: ${reason}\n${HELP}`);
    this.name = 'NonLocalDatabaseError';
    // The message is the whole story; a stack trace would only bury it.
    this.stack = `${this.name}: ${this.message}`;
  }
}

/**
 * Throws unless `value` is a Postgres URL on a loopback host.
 * The message never contains the URL, so credentials cannot leak into logs.
 */
export function assertLocalDatabaseUrl(value: string | undefined, name = 'DATABASE_URL'): URL {
  if (!value || !value.trim()) {
    throw new NonLocalDatabaseError(`${name} is not set.`);
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NonLocalDatabaseError(`${name} is not a valid URL.`);
  }

  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    throw new NonLocalDatabaseError(`${name} is not a Postgres URL.`);
  }

  if (!LOCAL_HOSTS.has(url.hostname)) {
    const host = url.hostname ? `"${url.hostname}"` : 'no host';
    throw new NonLocalDatabaseError(`${name} points at ${host}, which is not a local database.`);
  }

  for (const option of url.searchParams.keys()) {
    if (!SAFE_OPTIONS.has(option)) {
      throw new NonLocalDatabaseError(
        `${name} sets the connection option "${option}", which is not allowed because it could redirect the connection.`,
      );
    }
  }

  return url;
}

/** Same check, but passes when the variable is unset (nothing to connect to). */
export function assertLocalDatabaseUrlIfSet(
  value: string | undefined,
  name = 'DATABASE_URL',
): void {
  if (value === undefined || value.trim() === '') {
    return;
  }
  assertLocalDatabaseUrl(value, name);
}
