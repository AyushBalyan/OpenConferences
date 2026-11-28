// Turns a Umami "pages" export (views,visitors,visits,bounces,totaltime,path)
// into totals per screen. IDs in each address are replaced with [id], and the
// invented conference that browser tests and local runs use is counted apart.
//   node infra/redesign/audit/umami-by-screen.mjs <export.csv>
import { readFileSync } from 'node:fs';

const TEST_ID = /00000000-0000-4000-8000-0000000000\d\d/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const [, , file] = process.argv;
if (!file) {
  console.error('Usage: node infra/redesign/audit/umami-by-screen.mjs <export.csv>');
  process.exit(1);
}

const rows = readFileSync(file, 'utf8').trim().split('\n').slice(1);
const screens = new Map();
const test = { views: 0, visitors: 0, rows: 0 };
const conferences = new Set();

for (const row of rows) {
  const cells = row.split(',');
  const path = cells.slice(5).join(',').replace(/^"|"$/g, '').split('?')[0];
  const views = Number(cells[0]);
  const visitors = Number(cells[1]);
  const seconds = Number(cells[4]);
  if (TEST_ID.test(path)) {
    test.views += views;
    test.visitors += visitors;
    test.rows += 1;
    continue;
  }
  const conference = path.match(/^\/dashboard\/conferences\/([0-9a-f-]{36})/i);
  if (conference) conferences.add(conference[1]);
  const screen = path.replace(UUID, '[id]').replace(/\/$/, '') || '/';
  const total = screens.get(screen) ?? { views: 0, visitors: 0, seconds: 0, addresses: 0 };
  total.views += views;
  total.visitors += visitors;
  total.seconds += seconds;
  total.addresses += 1;
  screens.set(screen, total);
}

const sorted = [...screens.entries()].sort((a, b) => b[1].views - a[1].views);
console.log('views | visitors | seconds_per_view | addresses | screen');
for (const [screen, t] of sorted) {
  console.log(
    `${t.views} | ${t.visitors} | ${Math.round(t.seconds / Math.max(t.views, 1))} | ${t.addresses} | ${screen}`,
  );
}
console.log('');
console.log(`rows in export: ${rows.length}`);
console.log(`real conferences seen: ${conferences.size}`);
console.log(`test traffic left out: ${test.rows} rows, ${test.views} views`);
