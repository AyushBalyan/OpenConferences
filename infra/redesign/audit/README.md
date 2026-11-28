# Audit tooling

Phase 1 of the redesign audits what the product does today. Some of that can only be answered from real data: which settings conferences hold, and how often each task happens. These scripts answer those questions from a backup file, without connecting to production.

The rules for this are decision D11 in [DECISIONS.md](../../../docs/redesign/DECISIONS.md).

## The snapshot

`snapshot.sh` restores a backup file into a database called `audit_snapshot` on the local redesign Postgres server (port 55433).

```bash
infra/redesign/audit/snapshot.sh restore /path/to/backup.dump
infra/redesign/audit/snapshot.sh run infra/redesign/audit/settings.sql
infra/redesign/audit/snapshot.sh psql
infra/redesign/audit/snapshot.sh drop
```

- Only the `public` schema is restored.
- Tables that hold credentials (`accounts`, `sessions`, `verifications`, `two_factors`, `api_integration_keys`) are restored empty.
- Row-level security is left out, because the roles its policies name do not exist locally.
- The restore reports a few errors for foreign keys that point at the emptied tables. That is expected; they are listed in `out/restore-errors.log`.
- `run` and `psql` use read-only transactions.
- Query results go to `out/`, which git ignores. Nothing from `out/` is committed.

## What may be written down

The repository is public. An audit document may quote setting values (fees, dates, keys) and counts. It may not contain participant names, email addresses, paper titles or payment records.

## When Phase 1 ends

Run `snapshot.sh drop`. It deletes the database and the `out/` folder.
