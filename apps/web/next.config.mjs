import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, '../..');

// Monorepo: shared secrets live in repo-root .env; Next.js only reads apps/web by default.
loadDotenv({ path: path.join(monorepoRoot, '.env') });
loadDotenv({ path: path.join(__dirname, '.env.local') });

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: new URL('../../', import.meta.url).pathname,
  transpilePackages: ['@openconferences/contracts', '@openconferences/schemas'],
};

export default nextConfig;
