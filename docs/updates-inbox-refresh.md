# Reviewer invitation paging and Updates refresh

Implemented locally on 7 November 2026.

## Reviewer invitations

The invitation tab now requests one page of 20 invitations instead of calling the helper that fetched every page. Previous/Next navigate with cursor history. Searches are debounced for 300 ms, apply to email or lifecycle status on the server, and restart at page one. Results use descending creation time and ID for stable ordering, including equal timestamps. New invitations return to the first page; lifecycle actions refresh the current page. Failed page requests offer retry and do not present stale rows as the requested page. Obsolete responses cannot overwrite a newer request.

## Updates

The coordinator views are Conference activity and Reviewer invitations, alongside the existing Reviews of my papers and Author responses. Reviewer invitations has All responses, Accepted and Declined views. Conference activity excludes invitation responses in the new UI. Existing API consumers that omit filters still receive the combined feed.

Search, response categories and unread filtering run on the server before the 50-row page limit. Newer/Older navigation maintains cursor history. The unread count in the footer describes the current page; the existing navigation badge remains the total across all coordinator activity and invitation responses. Mark all read affects all matching rows up to the observed snapshot, including older pages, and leaves other response categories, searches and newer activity unread. Read receipts remain per account and continue to use CONFERENCE sources; no duplicate receipt kind or new access grant is introduced.

Private decline reasons are not included in this feed. Existing conference coordinator authorization, conference RLS, author-visible reviews and reviewer/round restrictions on author responses remain intact. Read actions do not send emails. Visible polling remains 30 seconds and pauses requests while the document is hidden. Refresh errors retain an explicitly labelled last snapshot; failed first loads do not claim the inbox is empty.

## Design direction and verification

The design taste app-screen direction was Achromatic ledger, retaining the existing Fresi shell, palette and type. The question is: what happened in this conference, and which reviewer responses need follow-up? The signature element is a response-specific queue with reviewer identity, Accepted/Declined status and a direct invitation-management action. Neutral underline navigation and compact rows prioritize the messages; color marks unread and accepted states. No invented totals or chart metrics are added.

The data inventory is conference event messages and subjects, reviewer invitation metadata/status/expiry, author-visible review updates and submitted author responses. Bulk invitation imports can reach 1,000 rows; invitation pages show 20 and event pages show 50. Coordinators triage responses on desktop and phone; authors retain their separate feedback view. Real event data drives every count. Desktop, tablet (768 px) and phone (390 px) layouts were inspected in browser fixtures, with request errors, empty states, search, read receipts and keyboard-operable controls.

Validation: 69 API/database tests passed, with five pre-existing decision tests skipped; all 11 Updates/invitation browser tests passed. API and web typechecks and targeted lint passed. The design source lint has zero failures; its two animation warnings are loading placeholders only, with reduced-motion support. Browser design inspection uses an authenticated synthetic snapshot; existing sidebar contrast/uppercase warnings are outside this screen change. Visual captures and the design sheet stay local.

## Database rollout

Apply the additive migrations before deployment:

- `20261107100000_updates_response_pagination`: chronological response-category index on conference updates.
- `20261107101000_invitation_page_index`: chronological conference invitation index.

Both were applied and checked on disposable local PostgreSQL databases. No production migrations or deployment were performed.
