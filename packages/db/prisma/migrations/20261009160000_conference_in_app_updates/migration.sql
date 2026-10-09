-- In-app activity is independent of mail templates, logs and delivery queues.
CREATE TABLE public.conference_updates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "organizationId" uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 "conferenceId" uuid NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('PAPER_SUBMITTED','PAPER_WITHDRAWN','INVITATION_ACCEPTED','INVITATION_DECLINED','REVIEW_SUBMITTED','REVIEW_UPDATED','REBUTTAL_SUBMITTED','REBUTTAL_UPDATED')),
 "sourceId" uuid NOT NULL, "sourceVersion" integer NOT NULL,
 message text NOT NULL, subject text NOT NULL, "paperId" uuid, "roundId" uuid,
 "createdAt" timestamp(3) NOT NULL DEFAULT (statement_timestamp() AT TIME ZONE 'UTC'),
 UNIQUE(kind,"sourceId","sourceVersion")
);
CREATE INDEX "conference_updates_conferenceId_createdAt_id_idx" ON public.conference_updates("conferenceId","createdAt" DESC,id DESC);
CREATE INDEX "conference_updates_organizationId_idx" ON public.conference_updates("organizationId");

CREATE FUNCTION public.app_can_read_conference_updates(conf_id uuid, org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT conf_id::text=public.app_current_conference_id() AND org_id::text=public.app_current_org_id()
 AND EXISTS (SELECT 1 FROM public.conferences c WHERE c.id=conf_id AND c."organizationId"=org_id)
 AND (public.app_is_platform_admin() OR EXISTS (
   SELECT 1 FROM public.memberships m JOIN public.role_grants g ON g."membershipId"=m.id
   WHERE m."userId"::text=public.app_current_user_id() AND m."organizationId"=org_id AND (
     (m.scope='CONFERENCE' AND m."conferenceId"=conf_id AND g.role IN ('ORGANIZER','CHAIR')) OR
     (m.scope='ORGANIZATION' AND g.role='ORG_ADMIN')
   )
 ));
$$;
REVOKE ALL ON FUNCTION public.app_can_read_conference_updates(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_can_read_conference_updates(uuid,uuid) TO openconferences_api;
ALTER TABLE public.conference_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conference_updates FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.conference_updates FROM PUBLIC;
GRANT SELECT ON public.conference_updates TO openconferences_api;
CREATE POLICY conference_update_reader ON public.conference_updates FOR SELECT TO openconferences_api
USING (public.app_can_read_conference_updates("conferenceId","organizationId"));

ALTER TABLE public.inbox_read_states DROP CONSTRAINT inbox_read_states_kind_check;
ALTER TABLE public.inbox_read_states ADD CONSTRAINT inbox_read_states_kind_check CHECK (kind IN ('REVIEW','REBUTTAL','CONFERENCE'));
DROP POLICY inbox_recipient ON public.inbox_read_states;
CREATE POLICY inbox_recipient ON public.inbox_read_states FOR ALL TO openconferences_api
USING (
 "userId"::text=public.app_current_user_id()
 AND public.app_conference_context_matches("conferenceId") AND public.app_org_context_matches("organizationId")
 AND public.app_user_in_conference("conferenceId")
 AND (kind<>'CONFERENCE' OR public.app_can_read_conference_updates("conferenceId","organizationId"))
)
WITH CHECK (
 "userId"::text=public.app_current_user_id()
 AND public.app_conference_context_matches("conferenceId") AND public.app_org_context_matches("organizationId")
 AND public.app_user_in_conference("conferenceId")
 AND (kind<>'CONFERENCE' OR public.app_can_read_conference_updates("conferenceId","organizationId"))
);

-- Only successful state transitions create activity, in the same transaction.
-- Runtime roles cannot call this trigger function directly or insert arbitrary activity.
CREATE FUNCTION public.app_capture_conference_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE event_kind text; event_message text; event_subject text; paper_id uuid; round_id uuid;
BEGIN
 IF TG_TABLE_NAME='papers' THEN
   IF OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
     event_kind:='PAPER_SUBMITTED'; event_message:='Paper submitted.';
   ELSIF NEW.status IN ('WITHDRAWN','WITHDRAWN_NONPAYMENT') AND OLD.status IS DISTINCT FROM NEW.status THEN
     event_kind:='PAPER_WITHDRAWN'; event_message:='Paper withdrawn.';
   ELSE RETURN NEW; END IF;
   event_subject:=concat_ws(' · ',NEW."submissionNumber",NEW.title); paper_id:=NEW.id;
 ELSIF TG_TABLE_NAME='reviewer_invitations' THEN
   IF OLD.status='PENDING' AND NEW.status IN ('ACCEPTED','DECLINED') THEN
     event_kind:=CASE WHEN NEW.status='ACCEPTED' THEN 'INVITATION_ACCEPTED' ELSE 'INVITATION_DECLINED' END;
     event_message:=CASE WHEN NEW.status='ACCEPTED' THEN 'Reviewer invitation accepted.' ELSE 'Reviewer invitation declined.' END;
     SELECT u.name INTO event_subject FROM public.users u WHERE u.id=NEW."invitedUserId";
     event_subject:=coalesce(nullif(btrim(event_subject),''),NEW.email);
     INSERT INTO public.conference_updates("organizationId","conferenceId",kind,"sourceId","sourceVersion",message,subject)
     VALUES(NEW."organizationId",NEW."conferenceId",event_kind,NEW.id,0,event_message,event_subject)
     ON CONFLICT(kind,"sourceId","sourceVersion") DO NOTHING;
   END IF;
   RETURN NEW;
 ELSIF TG_TABLE_NAME IN ('reviews','rebuttals') THEN
   IF NEW."submittedAt" IS NULL THEN RETURN NEW; END IF;
   IF TG_OP='UPDATE' AND NEW."submittedAt" IS NOT DISTINCT FROM OLD."submittedAt" THEN RETURN NEW; END IF;
   IF TG_TABLE_NAME='reviews' THEN
     event_kind:=CASE WHEN TG_OP='INSERT' OR OLD."submittedAt" IS NULL THEN 'REVIEW_SUBMITTED' ELSE 'REVIEW_UPDATED' END;
     event_message:=CASE WHEN event_kind='REVIEW_SUBMITTED' THEN 'Review submitted.' ELSE 'Review updated.' END;
   ELSE
     event_kind:=CASE WHEN TG_OP='INSERT' OR OLD."submittedAt" IS NULL THEN 'REBUTTAL_SUBMITTED' ELSE 'REBUTTAL_UPDATED' END;
     event_message:=CASE WHEN event_kind='REBUTTAL_SUBMITTED' THEN 'Author response submitted.' ELSE 'Author response updated.' END;
   END IF;
   paper_id:=NEW."paperId"; round_id:=NEW."roundId";
   SELECT concat_ws(' · ',p."submissionNumber",p.title) INTO event_subject FROM public.papers p WHERE p.id=paper_id;
 ELSE RETURN NEW; END IF;
 INSERT INTO public.conference_updates("organizationId","conferenceId",kind,"sourceId","sourceVersion",message,subject,"paperId","roundId")
 VALUES(NEW."organizationId",NEW."conferenceId",event_kind,NEW.id,NEW.version,event_message,event_subject,paper_id,round_id)
 ON CONFLICT(kind,"sourceId","sourceVersion") DO NOTHING;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.app_capture_conference_update() FROM PUBLIC;
CREATE TRIGGER conference_update_paper AFTER UPDATE OF status ON public.papers FOR EACH ROW EXECUTE FUNCTION public.app_capture_conference_update();
CREATE TRIGGER conference_update_invitation AFTER UPDATE OF status ON public.reviewer_invitations FOR EACH ROW EXECUTE FUNCTION public.app_capture_conference_update();
CREATE TRIGGER conference_update_review AFTER INSERT OR UPDATE OF "submittedAt" ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.app_capture_conference_update();
CREATE TRIGGER conference_update_rebuttal AFTER INSERT OR UPDATE OF "submittedAt" ON public.rebuttals FOR EACH ROW EXECUTE FUNCTION public.app_capture_conference_update();
