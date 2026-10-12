# Bot API v1 verification — 10 October 2026

Implemented and verified locally; no production migrations, deployment, credential issuance, bot-provider calls, or outbound mail were performed during verification. The feature defaults to disabled. The task-owned PostgreSQL and Redis services were stopped after verification; their temporary fixture files were retained locally.

## Checks completed

- All 50 migrations applied to a fresh task-owned PostgreSQL 17 cluster; runtime tests used `openconferences_api` with RLS enforced and without superuser/BYPASSRLS. The guarded migration helper also passed against the migrated local database.
- **32 bot tests passed**: 27 real HTTP/PostgreSQL/Redis tests and 5 credential/query/telemetry unit tests. Coverage includes key bootstrap under real RLS, malformed secrets, expiry, MFA/role loss, organization-admin inheritance, foreign conferences and IDs, scope boundaries, contact omission, stable integration aliases, encrypted cursors, individual/cycle/conference/legacy deadlines, historical cycles, inconsistent and retired work, read-only transactions, statement timeouts, revocation, reauthorization, active-key limits, Redis admission, audit outage and restricted-worker retention.
- **4 Playwright browser tests passed**, using a web-only local server and synthetic intercepted API responses: creation, dependency permissions, minimal key defaults, one-time token display/dismiss/reload, access check, rotation, suspension/resume, revocation, reauthorization, access-log empty state, refresh recovery, version-conflict recovery, role denial, mobile wrapping and keyboard focus. The chair lifecycle flow was rerun after adding the issuance-default capture and a stale-version refresh/retry assertion; it passed.
- **276 existing API regression tests passed; 45 were skipped by the existing suite.** These ran separately against the temporary local database using its fixture owner, with `.env` loading disabled. The new bot suite independently exercised restricted runtime roles. Skipped tests are not claimed as verified.
- API and worker builds passed. Web production build passed with the existing six unrelated lint warnings in bidding, MFA challenge, invitation acceptance, review editor, auth client and saved filters. Changed source files passed targeted lint; API/web typechecks passed.
- Generated OpenAPI drift check passed. Actionlint passed for the changed CI workflow; all 14 existing release-gate Python tests passed. `git diff --check` passed.
- A synthetic **1,000-paper/current-assignment** fixture verified bounded 25-row pages, non-overlapping cursors and full reviewer totals independent of page size. The last run's five sampled first-page HTTP requests peaked at **941 ms** while other local build/test work was active. This is correctness/load smoke evidence, not a production p95 measurement or capacity claim; staging load testing remains a rollout gate.

The HTTP bot suite uses real controllers and guards with a synthetic human-session stub; membership and MFA come from actual database fixtures. The separate existing regression suite exercises real human auth flows. Browser tests use synthetic API fixtures rather than claiming a live UI-to-database deployment test.

## UI review and documentation

The Impeccable detector ran once and returned no findings. The finish reviewer scored all three material UI fixes resolved: minimal key scopes at issuance, accurate “aliases” wording, and explicit effective permissions after Test access. Its final disposition was **ship at the scored-fix scope**. Desktop 1440px and mobile 390px captures plus the issuance-default capture are under `.impeccable/review/bot-integrations/`.

The documenter compared the shipped dashboard extension against existing controls, layouts, source and captures. Existing `apps/web/DESIGN.md` describes the landing-page world while the dashboard uses Inter, slate/indigo and rounded controls; the design sidecar is absent. This is pre-existing drift, preserved outside this feature's write boundary.

## Remaining rollout work

CI bootstrap follow-up, 12 October 2026: the isolated test helper now runs the shared pre-migration SQL before migrations. Verified on a new, empty task-owned local database: all 50 migrations and all 32 bot tests passed with restricted runtime roles. The OpenAPI drift check also passed. Production databases were not used.

Run the normal hosted CI checks on the eventual commit, apply the migration using the approved deployment process, configure a shared cursor secret and Redis, and enable the feature for a staging conference first. Validate production-like latency, proxy/IP configuration, retention backlog, monitoring and the actual provider adapter before enabling real grants. Grok/native bot adapters, OAuth, MCP, file access, write APIs and webhooks are outside v1.
