// Checks that every `path:line` reference in the audit documents points at a
// line that exists. Run from the repository root:
//   node infra/redesign/audit/check-refs.mjs docs/redesign/SETTINGS_AUDIT.md
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\n')
  .filter(Boolean);
const byName = new Map();
for (const file of files) {
  const name = basename(file);
  byName.set(name, [...(byName.get(name) ?? []), file]);
}

const lineCounts = new Map();
const countLines = (file) => {
  if (!lineCounts.has(file)) lineCounts.set(file, readFileSync(file, 'utf8').split('\n').length);
  return lineCounts.get(file);
};

let checked = 0;
const problems = [];
for (const doc of process.argv.slice(2)) {
  const text = readFileSync(doc, 'utf8');
  const pattern = /`([\w@./\[\]&-]+\.(?:ts|tsx|js|mjs|sql|sh|prisma|json|yml|dart|md)):(\d+)(?:[-,]\d+)*`/g;
  for (const match of text.matchAll(pattern)) {
    const [, ref, lineText] = match;
    const line = Number(lineText);
    let target = ref;
    if (!ref.includes('/') && !existsSync(ref)) {
      const candidates = byName.get(ref) ?? [];
      if (candidates.length !== 1) {
        problems.push(`${doc}: ${ref} matches ${candidates.length} files; write the full path`);
        continue;
      }
      target = candidates[0];
    }
    if (!existsSync(target)) {
      problems.push(`${doc}: ${target} does not exist`);
      continue;
    }
    checked += 1;
    if (line > countLines(target)) problems.push(`${doc}: ${target}:${line} is past the end of the file`);
  }
}

for (const problem of problems) console.error(problem);
console.log(`${checked} references checked, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
