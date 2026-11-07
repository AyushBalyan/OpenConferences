-- The invitation screen fetches one chronological page rather than every row.
CREATE INDEX "reviewer_invitations_page_idx"
  ON "reviewer_invitations" ("conferenceId", "createdAt" DESC, "id" DESC);
