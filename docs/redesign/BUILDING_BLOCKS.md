# Building blocks and modules

A proposal, drawn from the three Phase 1 audits, for what every conference always has and what can be switched on or off. Once the owner agrees it, the list is recorded in the decision log and the Phase 2 and Phase 3 cards are rewritten from it.

**Status: proposed, not yet agreed.**

Sources: [SETTINGS_AUDIT.md](SETTINGS_AUDIT.md) (IDs `ST-`), [CUSTOMISATION_AUDIT.md](CUSTOMISATION_AUDIT.md) (IDs `C-`) and [SCREEN_INVENTORY.md](SCREEN_INVENTORY.md) (IDs `S-`).

## The rule

- A **building block** exists in every conference. It cannot be switched off. Its differences between conferences are settings.
- A **module** is a feature with a switch per conference. When it is off, its menu entries, screens, phases, dates, emails and background jobs are gone for everyone in that conference. Nothing already collected is deleted.
- A conference created with every module off, and no setting changed, must run from call for papers to decisions.

## Fixed building blocks

Ground rule 3.1 lists eight: organisation, conference, track, submission, review form, phase, fee and registration. The audits support six of them as they are, show that two are really modules, and show four that are missing from the list.

| Block                | What it holds                                                         | Change from ground rule 3.1                                                                      | Evidence       |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------- |
| Organisation         | Name, legal identity, time zone, locale, sender name, payment account | Kept. Gains a profile: today it holds a name and nothing else.                                   | ST-36, C-301   |
| Person and role      | Account, membership of an organisation or conference, roles           | **Added.** Present in every flow and absent from the list.                                       | ST-24          |
| Conference           | Name, contact address, time zone, status, appearance (D9)             | Kept. Gains a profile.                                                                           | ST-31, C-055   |
| Phase                | The dated stages a conference moves through                           | Kept. Becomes rows, so a module that is off has no dates.                                        | ST-20, ST-21   |
| Submission           | Paper, versions, authors, files                                       | Kept.                                                                                            | ST-27 to ST-29 |
| Review form          | Criteria, scales, recommendation, confidence, text questions          | Kept. Becomes real: today it is three fixed scores in the review screen.                         | ST-01 to ST-06 |
| Review               | Invitation, assignment, review                                        | **Added.** The core of the product and absent from the list.                                     | ST-04, ST-07   |
| Decision             | Outcome, note to authors, release of reviews                          | **Added.**                                                                                       | S-103          |
| Email                | Templates per conference, sending, delivery log                       | **Added.** Every block sends email, and the wording is one organiser's today.                    | ST-34, C-012   |
| Track                | A named stream of submissions                                         | Kept as data: every conference has one. Letting authors choose between several becomes a module. | S-127          |
| Fee and registration | Fee table, registration, payment, invoice                             | **Moved to modules.** A conference that charges nothing must still be able to accept papers.     | C-253, ST-11   |

Ten building blocks: organisation, person and role, conference, phase, submission, review form, review, decision, email and track.

## Modules

The ten features from the approved Features settings mockup, checked against production use, plus one the audits add. "Default" is the proposed state for a new conference. Existing conferences are migrated to exactly what they do today.

| Module                   | What switches off with it                                                             | Screens                           | Depends on                            | Production use                     | Default |
| ------------------------ | ------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------- | ---------------------------------- | ------- |
| Reviewer bidding         | Bidding phase and dates, the reviewer's paper pool, bid oversight                     | S-075, S-076, S-097               | none                                  | 1 bid; off in code today           | Off     |
| Conflict declaration     | Declaring and listing conflicts; conflict checks when assigning                       | S-079, S-080, S-082               | none                                  | none; off in code today            | Off     |
| Author response          | The response phase and date, the response section, the reviewer's response tab        | S-049, S-057, S-034               | none                                  | 4 responses                        | Off     |
| Revisions                | Revision decisions, the revised-manuscript form, further review rounds                | S-047                             | none                                  | 18 revised versions                | On      |
| Final versions           | The final-version phase and date, the upload section, its reminder                    | S-050                             | none                                  | 35 final versions uploaded         | On      |
| Registration and payment | Fee table, registration section, payment, invoices, registration lists, fee reminders | S-051, S-052, S-114, S-122, S-154 | a payment account on the organisation | 114 registrations, 22 payments     | Off     |
| Student rate             | The student fee category and proof checking                                           | S-117                             | Registration and payment              | 23 proofs                          | Off     |
| Multiple tracks          | Track choice on submission and track management                                       | S-127                             | none                                  | every conference has one track     | Off     |
| Outreach campaigns       | Campaign screens, recipient lists, outreach templates and sending                     | S-134, S-135, S-141               | none                                  | 4 campaigns, 20 recipients         | Off     |
| Integrations             | API keys, the bot API and the phone app                                               | S-123, S-145                      | none                                  | 5 integrations, 5,259 calls logged | Off     |
| Reminder digests         | The combined reminder email for reviewers                                             | S-089                             | none                                  | 1 digest                           | Off     |

Reminder digests is the addition. Ground rule 3.4 names it, and it was not in the mockup.

Three things stay settings inside a block, not modules, because they have no screens of their own:

- **Automatic reminders** (email block): each kind can be switched off and given a lead time (ST-50).
- **Withdrawal for non-payment** (registration module): off by default; when off, an unpaid paper is only flagged (C-184).
- **Local price for one country** (registration module): off by default (ST-14).

## What "off" has to mean

The customisation audit found each of these today, so they are the tests a module switch has to pass.

1. **The menu does not show it.** Today the reviewer menu hides bidding by its own rule, separate from the switch (C-431).
2. **Settings do not ask for it.** Today the phases screen asks for bidding dates although bidding is off.
3. **The server refuses it,** in one place. Today the bidding switch is checked in six places in one service and duplicated in the web app (ST-22).
4. **Nothing depends on it silently.** Today, accepting a paper opens a paid registration even when no fees are set (C-253).
5. **Emails and jobs for it stop.**

## Decisions this needs

1. **Agree the ten building blocks,** including the four additions and moving fee and registration to modules. This changes ground rule 3.1.
2. **Agree the eleven modules and their defaults.**
3. **Fee categories.** The registration module keeps two audiences (regular, student) and two periods (early, regular) in the first version. Free-form categories are left for later. See decision 4 in the customisation audit.
4. **Where the payment account lives:** on the organisation, linked per conference. See decision 2 in the customisation audit.

## Cards this produces

Not applied to the board yet. They replace the current Phase 2 cards once the list above is agreed.

**Phase 2: rigid core**

| Card                                   | Covers                                                                                    | Replaces     |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | ------------ |
| Organisation and conference profiles   | Identity, time zone, locale, contact address, sender name                                 | P2-4         |
| Settings registry                      | One schema and default per setting; read and write validation; migrate today's values     | P2-1         |
| Phases as rows                         | One source for status and dates; one registration deadline                                | new          |
| Review form                            | Criteria, scales, recommendation, confidence; versioned; server checks reviews against it | part of P2-8 |
| Module switches                        | The eleven modules, with the five "off" tests above                                       | P2-2         |
| Registration as a module               | Accepting a paper without fees; non-payment flag; fee table without fallbacks             | new          |
| Neutral email templates per conference | Variables for every name and date; a conference level; wording rewritten                  | P2-3         |
| Provider-neutral payments              | One provider interface; account per organisation                                          | with P5-3    |
| Membership as the only link            | Retire the organisation field on users                                                    | P2-5         |
| Deletions                              | The agreed "cut" list from the customisation audit                                        | P2-6         |
| Default-settings lifecycle test        | All modules off, nothing changed, call for papers to decisions                            | P2-7         |

**Phase 3: design**

| Card                                   | Covers                                                                                            | Replaces |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| Navigation per role                    | Built from "Tasks by role" in the screen inventory; one assignment workspace; one acceptance flow | P3-1     |
| Roles and permissions                  | What a chair may do; fix the menu items the server refuses                                        | new      |
| Design tokens for both styles          | The roles from D9, in every theme                                                                 | P3-2     |
| Core components                        | Including the three parts that exist once per style                                               | P3-3     |
| The paper page                         | The busiest screen: sections that appear only when they apply                                     | new      |
| Reference flow: author submits a paper | Unchanged                                                                                         | P3-4     |
| Missing screens                        | Profile and security; members list with search                                                    | new      |
