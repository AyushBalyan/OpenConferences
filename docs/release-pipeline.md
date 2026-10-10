# Backend release pipeline

CI → Build Images → Push Images → Deploy.

Every successful push CI run for the current `main` commit builds both the API and worker. There is no changed-file gate. This deliberately includes test/documentation fixes: an earlier commit can contain backend changes that never shipped because its CI failed. Checking only `HEAD^..HEAD` loses those changes. Always building the complete tested commit avoids dependence on an expiring release baseline or remembering which failed commits remain pending. Docker layer caching limits repeated work, although every green main commit now starts image-build jobs.

## Release handoff and ordering

Build Images selects the commit from the triggering successful push CI, verifies it is still current main, and builds that exact checkout. Manual builds require successful push CI for that same commit; a newer failed or in-progress CI run takes precedence over an older green run.

Both image builds save their registry digests. The build marker is produced only after both builds succeed and their metadata matches the release commit. The marker records a schema version, repository, branch, commit, both digests, build run ID and run attempt. The promotion marker preserves these fields and adds its own run ID/attempt.

Push Images and Deploy download the required marker from their triggering run (or the explicitly selected manual source run). Missing/expired artifacts, incorrect provenance, incomplete image sets, incompatible markers and failed upstream runs block the release. A missing marker is an error, not a successful no-op. Artifacts are retained for 30 days; rerun Build Images after expiry. A rerun must use the marker from the matching source attempt.

Promotion preserves the source manifest format (`--prefer-index=false`) and uses recorded `@sha256:…` image references, so a mutable commit tag cannot substitute another image. Both images are checked before moving either tag, and both `main` and `latest` are verified afterward. The promotion artifact is uploaded only after verification. If promotion fails partway through, no deployment is admitted; rerun Push Images to reconcile both tags.

Push Images and Deploy share the `production-release` concurrency group with cancellation of running releases disabled. This prevents the pipeline from changing tags during migrations/restart/health verification. GitHub does not guarantee concurrency queue order, so the gates also reject superseded commits. Current-main checks run before promotion, migrations and restart. Only current-main releases are accepted; rollback is performed with a new revert commit through CI. External/manual changes to registry tags are outside this workflow lock.

Deploy verifies both promoted image digests before admitting migrations. A manual Deploy run resolves the commit from a validated successful promotion artifact, rather than assuming the current checkout matches the registry. The existing owner-role migration and Coolify webhook stages remain in place.

## Deployment verification

Both Docker images embed `RELEASE_SHA` and an OCI revision label in the final runtime layer. The API's `/api/v1/healthz` reports the revision (null for an unversioned local build). Deploy waits for the expected revision, a healthy health response and healthy readiness response. A still-running old API returning HTTP 200 can no longer finish the release successfully. Worker restart is acknowledged by the existing Coolify webhook; this pipeline does not claim a separate worker readiness probe.

Do not override `RELEASE_SHA` in Coolify: it comes from the built image. Production credentials remain in GitHub secrets. No new secrets or database migrations are required by these workflow changes.

## Manual recovery

Use Actions → **Build Images** → **Run workflow**, branch `main`, to build the current green commit and restart the automatic chain. This is the recovery path for the notification changes that the former latest-commit filter skipped.

To retry only promotion, run **Push Images** on `main` with `build_run_id` set to the successful Build Images run ID. To retry deployment, run **Deploy** on `main` with `promotion_run_id` set to the successful Push Images run ID. These IDs appear in the workflow run URL. The old manual SHA-only promotion input is replaced by a validated build-run input. Older unversioned markers are intentionally rejected; build again with the updated workflow.

`trigger_coolify=false` on manual Deploy explicitly runs migration-only recovery; restart and API verification are intentionally skipped in that mode. It still requires a valid promotion marker and matching images.

## Local checks

```sh
python3 -m unittest discover -s infra/ci -p 'test_*.py' -v
actionlint .github/workflows/ci.yml .github/workflows/build-images.yml \
  .github/workflows/push-images.yml .github/workflows/deploy.yml
```

CI runs the release-gate regressions and actionlint as a separate required-to-succeed job before any automatic release can begin. The tests use temporary files and mocked registry responses; they do not connect to GitHub, Coolify or a database. Health-controller tests mock the database and do not invoke readiness checks. Full live rollout is an external validation step, not something the local tests claim to execute.

GitHub documents that `workflow_run` uses the default branch's latest SHA, so downstream release selection must use the validated marker rather than blindly using `github.sha`. It also documents the concurrency ordering limits. [Workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run), [concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

Local validation for this change: 14 release-gate tests, five health-controller tests and 19 shared-schema tests passed. Native actionlint 1.7.12 validation, shell parsing of all changed workflow run steps, changed TypeScript lint, API typechecking and API/schema/contract builds passed. The matching container checker could not run because the local Docker daemon did not respond; it was stopped, and the native checker was used. The container includes additional shellcheck/pyflakes checks that will run in CI. No full Docker image build, registry promotion, workflow dispatch, deployment or production database access was performed locally.
