-- pg-boss v10 creates a job-table partition for each new queue. Runtime
-- roles have DML permissions but cannot attach partitions to the owner table.
-- Provision this queue during owner-run deployment, without elevating workers.
DO $$
DECLARE queue_partition text;
BEGIN
  -- Fresh installations initialize pg-boss separately; there is no queue
  -- catalog to provision until that bootstrap has run.
  IF to_regprocedure('pgboss.create_queue(text,json)') IS NULL THEN
    RETURN;
  END IF;
  PERFORM pgboss.create_queue('student.scan-recovery', '{}'::json);
  SELECT q.partition_name INTO queue_partition FROM pgboss.queue q
    WHERE q.name = 'student.scan-recovery';
  IF queue_partition IS NOT NULL THEN
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pgboss.%I TO openconferences_worker', queue_partition);
  END IF;
END;
$$;
