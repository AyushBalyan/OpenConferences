# Settings audit

Every place the product keeps a setting today, who reads and writes it, what real conferences hold, and what it should become. This is the Phase 1 input for the Phase 2 work on strict schemas, defaults and per-conference switches.

- **Code read:** the `redesign` branch on 2026-11-28.
- **Real values:** the backup of 2026-11-25, restored locally (decision D11). It holds 2 organisations and 5 conferences. Conferences are numbered 1 to 5 by creation date and not named.
- **Reproduce:** `infra/redesign/audit/snapshot.sh run infra/redesign/audit/settings.sql`.

A setting here means any value that changes how a conference behaves, wherever it is stored: a database column, a key in a free-form column, an environment variable or a constant in code.

## Decisions

**Decided by the owner on 2026-11-29 (decision D15):** all five proposals below are accepted.

1. **Which registration deadline is the real one?** It is stored twice and the two values disagree on both conferences that set it ([problem P1](#p1-the-registration-deadline-is-stored-twice-and-the-two-values-disagree)). Billing uses the one inside the fee schedule. Proposed: keep one, as a phase date.
2. **Should reviews be checked on the server?** Today the server accepts a review with no scores and no confidence, because every conference has an empty review configuration ([P2](#p2-the-review-configuration-is-empty-everywhere-so-the-server-checks-nothing)). Proposed: yes, from the review form that Phase 2 builds.
3. **Is the India price conversion a product feature or one organiser's rule?** A fee in US dollars is converted to rupees for payers in India at a rate stored on the conference (ST-14). Proposed: generalise to "local currency price for one country", off by default.
4. **Who owns the sender identity?** The "from" name and address, the contact address and the alert inbox are one value for the whole deployment (ST-30 to ST-35). Proposed: organisation settings, with a per-conference contact address.
5. **Reviewer bidding and conflict declaration** are switched off in code for everyone (ST-22, ST-23). Proposed: per-conference switches, default off, which matches production.

## What production holds

| Conference | Status     | Blinding | Dates set | Papers | Reviews | Registrations | Review configuration | Fee schedule |
| ---------- | ---------- | -------- | --------- | ------ | ------- | ------------- | -------------------- | ------------ |
| 1          | CFP closed | Single   | all 9     | 240    | 199     | 110           | empty                | full, USD    |
| 2          | CFP open   | Double   | 4 of 9    | 7      | 4       | 0             | empty                | zeros, INR   |
| 3          | CFP open   | Double   | none      | 0      | 0       | 0             | empty                | empty        |
| 4          | CFP open   | Double   | none      | 0      | 0       | 0             | empty                | empty        |
| 5          | CFP open   | Single   | all 9     | 7      | 7       | 4             | empty                | full, USD    |

Other facts from the backup that later sections rely on:

- **Roles in use:** 238 author grants, 200 reviewer grants, 4 organiser grants, 1 organisation admin and 1 platform admin. **No chair grant exists.**
- **Modules in use:** conference 1 has 4 outreach campaigns, 5 integrations, 23 student verifications, 1 reminder digest and 15 early-bird extensions. One bid and two author responses exist, on conference 2. No conflict declaration exists anywhere.
- **Templates:** 46 notification template rows for 29 keys, all at platform level. No organisation has its own copy of any template. 3 outreach templates, all at platform level.
- **Tracks:** every conference has exactly one track, except conference 4, which has none.

## The settings

Verdicts:

- **setting**: becomes a validated value with a default, at the scope shown (platform, organisation or conference).
- **environment**: stays a deployment variable.
- **code**: stays a constant in code.
- **remove**: deleted.

### Review

| ID    | Setting                           | Stored as                                                 | Read by                                                                                                             | Default today                        | Production                                     | Target                                                               | Verdict              |
| ----- | --------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------- | -------------------------------------------------------------------- | -------------------- |
| ST-01 | Score dimensions                  | `reviewConfig.scoreDimensions`                            | `apps/api/src/review/reviews.service.ts:854` (as objects); `apps/api/src/tenancy/tenancy.mapper.ts:17` (as strings) | none on the server                   | not set; reviews hold 3 keys, scored 1 to 5    | Review form: a list of criteria with key, label and scale, versioned | setting · conference |
| ST-02 | Recommendation required           | `reviewConfig.recommendationRequired`                     | nothing; a recommendation is always required (`reviews.service.ts:842`)                                             | true                                 | not set; all 209 submitted reviews have one    | Part of the review form                                              | setting · conference |
| ST-03 | Confidence required               | `reviewConfig.confidenceRequired` and `requireConfidence` | `reviews.service.ts:850` reads `requireConfidence`; the schema defines `confidenceRequired`                         | not required                         | not set; 191 of 209 submitted reviews have one | Part of the review form, one name                                    | setting · conference |
| ST-04 | Minimum reviews before a decision | `reviewConfig.minimumReviews`                             | `apps/api/src/review/review-stage.ts:20`, used by rounds, coordination, decisions, analytics and the bot API        | 1                                    | not set, so 1                                  | Review setting                                                       | setting · conference |
| ST-05 | Blinding                          | column `blindingMode`                                     | review and submission mappers                                                                                       | Double (`conference.service.ts:190`) | Single on 2, Double on 3                       | Unchanged                                                            | setting · conference |
| ST-06 | Score keys on the review screen   | constant `SCORE_KEYS`                                     | `apps/web/src/components/dashboard/reviews/review-editor/review-editor-panel.tsx:20`                                | originality, clarity, significance   | matches what reviews hold                      | Read from the review form                                            | remove               |
| ST-07 | Days a reviewer has to review     | constant `REVIEW_ASSIGNMENT_WINDOW_DAYS`                  | `packages/schemas/src/review.ts:393`                                                                                | 7                                    | n/a                                            | Review setting                                                       | setting · conference |

### Fees and registration

| ID    | Setting                             | Stored as                                                           | Read by                                                                                                      | Default today                                    | Production                                   | Target                                               | Verdict              |
| ----- | ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------- | -------------------- |
| ST-10 | Currency                            | `feeSchedule.currency`                                              | billing services; `apps/api/src/analytics/analytics.service.ts:258`                                          | INR in the mapper and analytics; USD in the form | USD on 2, INR on 1, missing on 2             | Required once registration is on                     | setting · conference |
| ST-11 | Fee table                           | `feeSchedule.matrix`                                                | `apps/api/src/billing/fee-resolver.ts`, registrations, payments, student verification                        | zeros in the mapper; an error in billing         | 3 conferences; audience by timing            | Fee rows: audience, timing, amount                   | setting · conference |
| ST-12 | Early price ends                    | `feeSchedule.earlyBirdEndsAt`                                       | fee resolver; `apps/worker/src/reminder-sweep.ts:259`                                                        | none                                             | set on 2                                     | Phase date                                           | setting · conference |
| ST-13 | Fee for an additional paper         | `feeSchedule.additionalPaperMinor`                                  | `fee-resolver.ts:98`                                                                                         | none                                             | set on 2                                     | Fee row                                              | setting · conference |
| ST-14 | Rupees per US dollar for India      | `feeSchedule.domesticInrPerUsd`                                     | `fee-resolver.ts:108`; analytics                                                                             | none; an error for payers in India if missing    | 95 on 2                                      | Local-currency price for one country, off by default | setting · conference |
| ST-15 | Registration deadline               | `feeSchedule.registrationDeadlineAt` and column `registrationDueAt` | `fee-resolver.ts:67` prefers the fee schedule value                                                          | none; an error if both are missing               | both set on 2 conferences, and they disagree | One phase date                                       | setting · conference |
| ST-16 | Grace days after the deadline       | variable `REGISTRATION_ADDITIONAL_GRACE_DAYS`                       | `apps/api/src/billing/discard-sweep.service.ts:39`, `student-verification.service.ts:405`                    | 7                                                | deployment value                             | Registration setting                                 | setting · conference |
| ST-17 | Per-paper early price extension     | column `registrations.earlyBirdExtendedUntil`                       | registrations service                                                                                        | none                                             | 15 registrations                             | Unchanged; it is data, not a setting                 | code                 |
| ST-18 | Largest early-price extension batch | constant `EARLY_BIRD_EXTENSION_MAX_REGISTRATIONS`                   | `packages/schemas/src/billing.ts:260`                                                                        | 200                                              | n/a                                          | Platform limit                                       | code                 |
| ST-19 | Example fees                        | constant `CONFERENCE_2026_FEES`, repeated as form defaults          | `packages/schemas/src/tenancy.ts:64`; `apps/web/src/components/dashboard/settings/settings-workspace.tsx:63` | one conference's 2026 prices                     | conference 1 matches it                      | Empty form with the organisation's currency          | remove               |

### Phases and dates

| ID    | Setting          | Stored as                                    | Read by                                              | Default today | Production                                 | Target                                               | Verdict              |
| ----- | ---------------- | -------------------------------------------- | ---------------------------------------------------- | ------------- | ------------------------------------------ | ---------------------------------------------------- | -------------------- |
| ST-20 | Nine phase dates | columns `cfpOpensAt` to `registrationDueAt`  | `tenancy.mapper.ts:118` derives the status from them | none          | all set on 2, some on 1, none on 2         | Phases as rows, so a module that is off has no dates | setting · conference |
| ST-21 | Status           | column `status`, also derived from the dates | `tenancy.mapper.ts:73`; `conference.service.ts:366`  | Draft         | 2 conferences are "CFP open" with no dates | One source: derived from phases                      | setting · conference |

### Reviewers and invitations

| ID    | Setting                        | Stored as                                         | Read by                                                                                            | Default today | Production      | Target          | Verdict              |
| ----- | ------------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------- | --------------- | --------------- | -------------------- |
| ST-22 | Reviewer bidding on or off     | constant `REVIEWER_BIDDING_ENABLED`, in two files | `apps/api/src/review/reviewer-features.ts:5`; `apps/web/src/lib/reviewer-features.ts:6`            | off           | 1 bid in total  | Module switch   | setting · conference |
| ST-23 | Conflict declaration on or off | constant `REVIEWER_COI_ENABLED`, in two files     | `apps/api/src/review/reviewer-features.ts:6`; `apps/web/src/lib/reviewer-features.ts:7`            | off           | no declarations | Module switch   | setting · conference |
| ST-24 | Days an invitation stays valid | column `invitationLifetimeDays`                   | `apps/api/src/review/invitations.service.ts:178`                                                   | 7             | 7 everywhere    | Unchanged       | setting · conference |
| ST-25 | The same, as a constant        | constant `REVIEWER_INVITATION_TTL_DAYS`           | `apps/api/src/auth/auth.config.ts:251`; `apps/api/src/integrations/bot-invitations.service.ts:191` | 7             | n/a             | Use ST-24       | remove               |
| ST-26 | Reminder digest limits         | constants `DIGEST_MAX_*`                          | `packages/schemas/src/reviewer-overview.ts:71`                                                     | 50, 500, 100  | n/a             | Platform limits | code                 |

### Submission

| ID    | Setting                                  | Stored as                           | Read by                                        | Default today   | Production | Target                                       | Verdict              |
| ----- | ---------------------------------------- | ----------------------------------- | ---------------------------------------------- | --------------- | ---------- | -------------------------------------------- | -------------------- |
| ST-27 | Papers one corresponding author may hold | constant `MAX_CORRESPONDING_PAPERS` | `apps/api/src/submission/papers.service.ts:69` | 2               | n/a        | Submission setting, default no limit         | setting · conference |
| ST-28 | Manuscript file type and size            | constants                           | `apps/api/src/files/files.service.ts:29`       | PDF, 50 MB      | n/a        | Submission setting within a platform ceiling | setting · conference |
| ST-29 | Title, abstract and keyword limits       | schema literals                     | `packages/schemas/src/submission.ts:25`        | 500, 10,000, 20 | n/a        | Platform limits                              | code                 |

### Identity and email

| ID    | Setting                                         | Stored as                                                                        | Read by                                                                              | Default today                         | Target                                                         | Verdict                |
| ----- | ----------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------- | ---------------------- |
| ST-30 | Sender address and name                         | variables `MAIL_FROM`, `MAIL_FROM_NAME`                                          | worker mailer                                                                        | a placeholder address                 | Platform sending address; organisation display name            | setting · organisation |
| ST-31 | Contact address in every email                  | variable `MAIL_CONTACT_EMAIL`                                                    | about 11 places in the API and worker                                                | one conference's address, set in code | Conference contact address, falling back to the organisation's | setting · conference   |
| ST-32 | Inbox alerted on each submission                | variable `SUBMISSION_ALERT_EMAIL`                                                | `apps/api/src/messaging/notification.publisher.ts:101`; `apps/worker/src/scan.ts:73` | none                                  | Conference notification setting                                | setting · conference   |
| ST-33 | Outreach sender and reply address               | variables `OUTREACH_FROM_NAME`, `OUTREACH_FROM_EMAIL`, `OUTREACH_REPLY_TO_EMAIL` | `apps/api/src/outreach/outreach.service.ts:42`, copied onto each campaign            | placeholders                          | Organisation outreach identity                                 | setting · organisation |
| ST-34 | Email templates                                 | table `notification_templates`, platform or organisation                         | `apps/api/src/messaging/template.service.ts`                                         | 29 platform templates                 | Add a conference level                                         | setting · conference   |
| ST-35 | Outreach templates                              | table `outreach_templates`, platform, organisation or conference                 | outreach service                                                                     | 3 platform templates                  | Unchanged scopes                                               | setting · conference   |
| ST-36 | Organisation legal name, address and tax number | not stored anywhere                                                              | the invoice shows only the conference name                                           | none                                  | Organisation profile, printed on invoices                      | setting · organisation |
| ST-37 | Invoice number prefix and day boundary          | derived from the conference name; time zone fixed in code                        | `packages/db/src/invoice-number.ts:5`                                                | India time                            | Organisation time zone; conference invoice prefix              | setting · organisation |

### Payments

| ID    | Setting                 | Stored as                                                                     | Read by                                                | Default today              | Target                                    | Verdict                |
| ----- | ----------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------- | ----------------------------------------- | ---------------------- |
| ST-40 | Payment gateway account | variables `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | `apps/api/src/billing/payment-provider.registry.ts:19` | a mock provider when unset | Connected once per organisation (Phase 5) | setting · organisation |
| ST-41 | Webhook replay window   | variable `PAYMENT_WEBHOOK_REPLAY_WINDOW_SECONDS`                              | billing webhooks                                       | 300                        | Unchanged                                 | environment            |

### Modules with a deployment-wide switch

| ID    | Setting                          | Stored as                                                  | Read by                                                | Default today | Target                                   | Verdict              |
| ----- | -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ | ------------- | ---------------------------------------- | -------------------- |
| ST-45 | Bot API on or off                | variable `BOT_API_ENABLED`, read directly from the process | `apps/api/src/integrations/integration.security.ts:37` | off           | Module switch                            | setting · conference |
| ST-46 | Outreach provider                | variables `OUTREACH_MAIL_PROVIDER`, `OUTREACH_SES_ENABLED` | outreach worker                                        | log only      | Unchanged; the module switch is separate | environment          |
| ST-47 | File scanning                    | variable `CLAMAV_ENABLED`                                  | file scan job                                          | off           | Unchanged                                | environment          |
| ST-48 | Outreach recipients per campaign | constant `OUTREACH_MAX_RECIPIENTS`                         | `packages/schemas/src/outreach.ts:4`                   | 500           | Plan limit (Phase 5)                     | code                 |

### Fixed periods in code

| ID    | Setting                               | Stored as | Where                                                       | Value today         | Target                            | Verdict                |
| ----- | ------------------------------------- | --------- | ----------------------------------------------------------- | ------------------- | --------------------------------- | ---------------------- |
| ST-50 | Reminder lead time                    | literals  | `apps/worker/src/reminder-sweep.ts:114`, `:324`, `:373`     | 3 days              | Reminder setting                  | setting · conference   |
| ST-51 | Time of the daily reminder run        | schedule  | `apps/worker/src/main.ts:77`                                | 08:00 UTC           | Platform schedule                 | code                   |
| ST-52 | "At risk" window for registrations    | constant  | `apps/api/src/billing/registrations.service.ts:57`          | 7 days              | Platform default                  | code                   |
| ST-53 | Dates and money shown in India format | literals  | `apps/web/src/components/billing/registration-card.tsx:619` | `en-IN`, India time | Organisation time zone and locale | setting · organisation |

### Deployment variables that stay as they are

These configure the installation, not a conference: `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, the `S3_*` group, the `API_*` group, `CORS_ORIGINS`, `WEB_URL`, `NEXT_PUBLIC_API_URL`, `SENTRY_DSN`, `LOG_LEVEL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_LOCKOUT_MAX_ATTEMPTS`, `AUTH_LOCKOUT_WINDOW_SECONDS`, `TURNSTILE_SECRET_KEY`, `ZEPTO_MAIL_API_KEY`, `ZEPTO_MAIL_API_URL`, `ZEPTO_WEBHOOK_SECRET`, `NOTIFICATION_RETENTION_DAYS`, `CLAMAV_HOST`, `CLAMAV_PORT`, `SES_REGION`, `SES_ACCESS_KEY_ID`, `SES_SECRET_ACCESS_KEY`, `OUTREACH_SES_CONFIGURATION_SET`. All are defined in `packages/config/src/env/index.ts`. Verdict for each: **environment**.

## Problems found

### P1. The registration deadline is stored twice and the two values disagree

`registrationDueAt` is a column edited on the phases screen. `feeSchedule.registrationDeadlineAt` is edited on the fees screen. Billing prefers the fee schedule value (`apps/api/src/billing/fee-resolver.ts:67`).

| Conference | Column (phases screen) | Fee schedule (used by billing) |
| ---------- | ---------------------- | ------------------------------ |
| 1          | 15 December 2026       | 10 December 2026               |
| 5          | 25 November 2026       | 28 November 2026               |

On conference 1 the phases screen shows a deadline five days later than the one billing enforces.

### P2. The review configuration is empty everywhere, so the server checks nothing

No screen writes `reviewConfig` (the only writer is `apps/api/src/tenancy/conference.service.ts:331`, and the settings form does not send it). With an empty configuration, `validateReviewForSubmit` has no criteria to check and does not require confidence.

Evidence in the backup: 209 reviews are submitted. On conference 1, 5 of the 198 submitted reviews hold no scores, and 17 hold no confidence. The three score keys that do exist come from the constant in the review screen (ST-06), not from any setting.

### P3. Score dimensions have two incompatible shapes

The schema (`packages/schemas/src/tenancy.ts:74`) defines `scoreDimensions` as a list of names and gives it a default. The review service (`apps/api/src/review/reviews.service.ts:41`) expects a list of objects with a key. If a settings save ever includes `reviewConfig`, the default list of names is stored, and every later review submission fails with "Score for undefined is required". Production is not affected today, only because nothing writes this column.

### P4. Two settings have names that do not match

- The schema writes `confidenceRequired`. The review service reads `requireConfidence`.
- `recommendationRequired` is written and never read.

### P5. An empty fee schedule is an error, not "registration is off"

Billing throws "Conference fee schedule is not configured" (`fee-resolver.ts:12`) when the fee schedule is empty. Conferences 3 and 4 are in that state. A second parser in `apps/api/src/tenancy/tenancy.mapper.ts:37` treats the same empty value as rupees with zero fees, so the settings screen and billing disagree about what an unconfigured conference is.

### P6. Saving fees replaces the whole fee schedule

`conference.service.ts:332` stores the submitted object as it is. A caller that sends only part of the fee schedule deletes the rest. The web form always sends everything, so this is only reachable through the API.

### P7. A settings save is not logged when it also changes the status

`conference.service.ts:366` returns after the status transition and skips the `conference.settings_updated` entry at line 381. The change of status is logged; the changed dates and fees are not.

### P8. The invitation lifetime setting is ignored in two places

Invitation records use the conference's `invitationLifetimeDays`. The sign-in link inside the invitation (`auth.config.ts:251`) and invitations created through the bot API (`bot-invitations.service.ts:191`) use the constant 7. Every conference is on 7 today, so nothing differs yet.

### P9. Some conferences are open with nothing configured

Conferences 3 and 4 have the status "CFP open" with no dates, and conference 4 has no track. The status column and the dates can each say something different (ST-21).

### P10. Live email text names one conference

In the backup, the active platform template `submission.corresponding_limit` and the active outreach template `tpc_invitation` contain one conference's name and web address. `MAIL_CONTACT_EMAIL` defaults to that conference's address in code. A second organisation on this deployment would send these to its own participants. The customisation audit lists each occurrence.

## Possible bugs in the live product

These could matter on `main` today. They are reported here and not fixed in the redesign; a fix would be a separate change on `main`.

| Problem | Why it may matter now                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| P1      | Organisers of conference 1 see 15 December as the registration deadline while payment closes on 10 December. |
| P2      | Five submitted reviews on conference 1 carry no scores.                                                      |
| P7      | Changes to dates and fees made in the same save as a status change leave no audit entry.                     |
| P10     | The corresponding-author limit email names conference 1 whichever conference sends it.                       |

## What this means for Phase 2

1. **One schema per group of settings**, validated on write and on read, with defaults: review, fees, phases, submission, reminders, identity.
2. **Migrate, do not reset.** Every conference has an empty review configuration, so the migration writes today's real behaviour as explicit values: three criteria scored 1 to 5, recommendation required, confidence optional, minimum of one review.
3. **Collapse the duplicates:** one registration deadline, one early-price date, one invitation lifetime, one status.
4. **Move identity out of the environment** onto the organisation and the conference.
5. **Turn four code switches into module switches:** reviewer bidding, conflict declaration, the bot API and outreach.
6. **Decide what "not configured" means** for fees: registration is off, with no error.
