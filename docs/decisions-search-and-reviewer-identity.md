# Decisions search and reviewer identity

The Decisions workspace provides a shared **Find a paper** search for pending papers and recorded decisions. It matches any part of a paper title or submission code, ignores case, and trims surrounding whitespace. It searches all loaded API pages. Clear search restores the full list.

Pending-paper navigation and Select all apply to the matching papers. Changing the search clears bulk selections and confirmation, while retaining drafted outcomes and messages. Conference progress counts continue to describe the whole queue; the queue count shows matching and total papers. A search with no matches shows an explicit empty state.

Review cards display a reviewer's name, falling back to their email when the name is blank. The API adds the optional `reviewerName` and `reviewerEmail` fields only for a chair, organizer, or platform admin who is not an author of that paper. An organization-admin role alone does not grant these identity fields. The UI also checks these roles before rendering identity.

Authors and coauthors receive the existing anonymized, released-review response, including when they also hold a committee or platform-admin role. Reviewer identity and private committee comments are omitted from that response in single-blind and double-blind conferences. This change does not expose identity to authors in open conferences either.

No database migration is required.

## Verification

- Browser fixtures: `SKIP_ENV_FILE=true corepack pnpm exec playwright test --config playwright.decisions.config.ts`. This starts a local web server and intercepts API requests; it does not connect to a database.
- API permission matrix: `SKIP_ENV_FILE=true corepack pnpm --filter @openconferences/api exec vitest run --config vitest.integration.config.ts src/review/reviews.service.test.ts`.
- Real HTTP privacy checks are included in `apps/api/test/integration/review.test.ts`. Run these only with explicitly configured disposable local PostgreSQL and Redis, with `SKIP_ENV_FILE=true`; never use production credentials for testing.
