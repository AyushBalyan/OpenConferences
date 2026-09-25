-- Run with psql -v ON_ERROR_STOP=1 against an isolated migrated database. Always rolls back fixtures.
BEGIN;
INSERT INTO organizations (id, slug, name, "updatedAt") VALUES ('00000000-0000-0000-0000-000000000001', 'inbox-test', 'Inbox test', now());
INSERT INTO users (id, name, email, "updatedAt") VALUES
('00000000-0000-0000-0000-000000000002', 'Reader', 'inbox-reader@example.test', now()),
('00000000-0000-0000-0000-000000000003', 'Other', 'inbox-other@example.test', now());
INSERT INTO conferences (id, "organizationId", slug, name, "authorJoinToken", "updatedAt") VALUES
('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'inbox-test', 'Inbox test', '00000000-0000-0000-0000-000000000005', now());
INSERT INTO memberships (id, "userId", "organizationId", "conferenceId", scope) VALUES
('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'CONFERENCE'),
('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'CONFERENCE');
SET LOCAL ROLE openconferences_api;
SET LOCAL app.current_user_id = '00000000-0000-0000-0000-000000000002';
SET LOCAL app.current_org_id = '00000000-0000-0000-0000-000000000001';
SET LOCAL app.current_conference_id = '00000000-0000-0000-0000-000000000004';
INSERT INTO inbox_read_states (id, "organizationId", "conferenceId", "userId", kind, "sourceId", "readVersion", "updatedAt") VALUES
('00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'REVIEW', '00000000-0000-0000-0000-000000000009', 1, now());
DO $$ BEGIN
  IF (SELECT count(*) FROM inbox_read_states) <> 1 THEN RAISE EXCEPTION 'Owner cannot read receipt'; END IF;
  UPDATE inbox_read_states SET "readVersion" = 2;
  IF (SELECT "readVersion" FROM inbox_read_states) <> 2 THEN RAISE EXCEPTION 'Owner cannot update receipt'; END IF;
  BEGIN
    UPDATE inbox_read_states SET "userId" = '00000000-0000-0000-0000-000000000003';
    RAISE EXCEPTION 'Ownership reassignment unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SET LOCAL app.current_user_id = '00000000-0000-0000-0000-000000000003';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM inbox_read_states) THEN RAISE EXCEPTION 'Cross-user read allowed'; END IF;
  UPDATE inbox_read_states SET "readVersion" = 9;
  IF FOUND THEN RAISE EXCEPTION 'Cross-user update allowed'; END IF;
END $$;
SET LOCAL app.current_user_id = '00000000-0000-0000-0000-000000000002';
SET LOCAL app.current_conference_id = '00000000-0000-0000-0000-000000000010';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM inbox_read_states) THEN RAISE EXCEPTION 'Cross-conference read allowed'; END IF;
END $$;
ROLLBACK;
