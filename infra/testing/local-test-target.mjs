const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);
const DATABASE_OPTIONS = new Set([
  'schema',
  'connection_limit',
  'pool_timeout',
  'connect_timeout',
  'application_name',
  'sslmode',
  'uselibpqcompat',
]);
function parse(value, label, protocols) {
  let url;
  try {
    if (!value) throw new Error();
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be explicitly supplied as a valid local test URL`);
  }
  if (!protocols.includes(url.protocol) || !LOOPBACK.has(url.hostname) || url.hash)
    throw new Error(`${label} must use a loopback host; shared/remote targets are forbidden`);
  if (url.port && (!/^\d{1,5}$/.test(url.port) || Number(url.port) < 1 || Number(url.port) > 65535))
    throw new Error(`${label} has an invalid test port`);
  return url;
}
export function assertLocalDatabaseUrl(value, { prefix } = {}) {
  const url = parse(value, 'DATABASE_URL', ['postgres:', 'postgresql:']);
  let name;
  try {
    name = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error('Invalid test database name');
  }
  if (
    !/^[a-zA-Z0-9_-]+$/.test(name) ||
    !(prefix ? name.startsWith(prefix) : name.endsWith('_test'))
  )
    throw new Error('Database must have an explicit disposable test name');
  for (const key of url.searchParams.keys())
    if (!DATABASE_OPTIONS.has(key))
      throw new Error('Test database URL contains a forbidden connection override');
  return url;
}
export function assertLocalRedisUrl(value) {
  const url = parse(value, 'REDIS_URL', ['redis:', 'rediss:']);
  if (
    url.search ||
    !/^\/(?:\d{1,3})?$/.test(url.pathname || '/') ||
    Number(url.pathname.slice(1) || 0) > 255
  )
    throw new Error('Test Redis URL must select only a local numbered database');
  return url;
}
export function assertTestMarker(value) {
  if (!value || !/^[a-zA-Z0-9:_-]{8,100}$/.test(value))
    throw new Error('LOCAL_TEST_DATABASE_MARKER is required for a disposable database');
  return value;
}
