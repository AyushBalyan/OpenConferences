/**
 * Prints one clear line about the database the redesign is about to use, or
 * the reason it refuses to. Run before anything else by `pnpm redesign:dev`.
 * Imports the guard's source directly so it works before the workspace is built.
 */
import { assertLocalDatabaseUrl } from '../../config/src/env/local-only';

try {
  const url = assertLocalDatabaseUrl(process.env.DATABASE_URL);
  console.log(`Database: ${url.pathname.slice(1)} on ${url.host} (local)`);
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
