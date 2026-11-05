-- File scanning activates a clean revised manuscript and opens its next cycle
-- atomically. The worker may insert only revision follow-up cycles, not edit or
-- delete existing rounds.
CREATE POLICY review_rounds_worker_revision_insert ON public.review_rounds
FOR INSERT TO openconferences_worker
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.papers p
    JOIN public.paper_versions v ON v.id = p."currentVersionId"
    JOIN public.file_assets f ON f.id = v."fileAssetId"
    WHERE p.id = review_rounds."paperId"
      AND p."conferenceId" = review_rounds."conferenceId"
      AND p."organizationId" = review_rounds."organizationId"
      AND p.status = 'UNDER_REVIEW'
      AND v.kind = 'REVISION' AND f."scanStatus" = 'CLEAN'
  )
  AND EXISTS (
    SELECT 1 FROM public.review_rounds previous
    JOIN public.decisions d ON d."roundId" = previous.id
    WHERE previous."paperId" = review_rounds."paperId"
      AND previous."conferenceId" = review_rounds."conferenceId"
      AND previous."roundNumber" = review_rounds."roundNumber" - 1
      AND d.outcome IN ('MINOR_REVISION', 'MAJOR_REVISION')
      AND d."notifiedAt" IS NOT NULL
  )
);
