import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse as parseDotenv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');

function loadSharedEnv(filePath) {
  try {
    const parsed = parseDotenv(readFileSync(filePath));
    delete parsed.NODE_ENV;
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional env files are ignored when missing.
  }
}

// Monorepo: shared secrets live in repo-root .env; Next.js only reads apps/web by default.
// NODE_ENV is omitted so Next.js controls it (development vs production build).
loadSharedEnv(path.join(monorepoRoot, '.env'));
loadSharedEnv(path.join(__dirname, '.env.local'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  transpilePackages: ['@openconferences/contracts', '@openconferences/schemas'],
};

export default nextConfig;
