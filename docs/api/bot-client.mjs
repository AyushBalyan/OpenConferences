// Node 20+. Server-side only; never log the key or personal response contents.
const { BOT_API_BASE_URL, BOT_CONFERENCE_ID, BOT_API_KEY } = process.env;
if (!BOT_API_BASE_URL || !BOT_CONFERENCE_ID || !BOT_API_KEY)
  throw new Error('Missing bot client configuration');
const base = new URL(BOT_API_BASE_URL);
if (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
  throw new Error('Use HTTPS outside localhost');
const prefix = `${base.toString().replace(/\/$/, '')}/integrations/v1/conferences/${encodeURIComponent(BOT_CONFERENCE_ID)}`;
async function get(path) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(prefix + path, {
      headers: { Authorization: `Bearer ${BOT_API_KEY}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if ((response.status === 429 || response.status === 503) && attempt < 2) {
      const seconds = Math.min(
        60,
        Math.max(1, Number(response.headers.get('retry-after')) || 2 ** attempt),
      );
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      continue;
    }
    if (!response.ok)
      throw new Error(
        `Bot API request failed (${response.status}); check credential, scope and conference`,
      );
    return response.json();
  }
  throw new Error('Retry budget exhausted');
}
const capabilities = await get('/capabilities');
if (!capabilities.scopes.includes('papers:read')) throw new Error('papers:read is required');
let cursor = null,
  count = 0;
for (let page = 0; page < 100; page++) {
  const query = new URLSearchParams({ limit: '100' });
  if (cursor) query.set('cursor', cursor);
  const result = await get('/papers?' + query);
  count += result.data.length;
  // Process result.data privately here; forward only fields approved for your bot.
  cursor = result.nextCursor;
  if (!cursor) break;
}
if (cursor) throw new Error('Page budget reached; narrow the query or resume pagination');
console.log(`Read ${count} paper metadata records.`);
