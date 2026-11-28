import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse as parseDotenv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');

// The redesign reads .env.redesign, never the root .env (which points at
// production). Variables already set in the environment win over the file.
// NODE_ENV is left to Next.js.
function loadRedesignEnv(filePath) {
  try {
    const parsed = parseDotenv(readFileSync(filePath));
    delete parsed.NODE_ENV;
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // The file is optional; CI sets the variables directly.
  }
}

if (process.env.SKIP_ENV_FILE !== 'true') {
  loadRedesignEnv(path.join(monorepoRoot, '.env.redesign'));
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
  // The health page is the only screen for now, so the root address leads to it.
  async redirects() {
    return [{ source: '/', destination: '/health', permanent: false }];
  },
};

export default nextConfig;
