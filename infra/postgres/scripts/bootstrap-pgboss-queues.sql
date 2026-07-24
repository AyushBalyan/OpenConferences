-- Bootstrap pg-boss queues as the DB owner (postgres / migration role).
-- Restricted roles (openconferences_api / openconferences_worker) can DML and CREATE
-- partitions but cannot ATTACH PARTITION on pgboss.job unless they own that table.
-- Run once (or after adding a new queue name) with the owner DATABASE_URL:
--
--   psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f infra/postgres/scripts/bootstrap-pgboss-queues.sql
--
-- Strip uselibpqcompat from the URL for psql if present.

SELECT pgboss.create_queue(name, '{}'::json)
FROM unnest(
  ARRAY[
    'noop.smoke',
    'email.send',
    'notification.send',
    'notification.reminder_sweep',
    'file.scan',
    'invoice.generate',
    'registration.discard_sweep',
    'payment.reconcile'
  ]
) AS name;

SELECT name, created_on
FROM pgboss.queue
ORDER BY name;
