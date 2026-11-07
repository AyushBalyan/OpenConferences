-- Filter reviewer response feeds before applying the bounded chronological page.
CREATE INDEX "conference_updates_response_page_idx"
  ON "conference_updates" ("conferenceId", "kind", "createdAt" DESC, "id" DESC);
