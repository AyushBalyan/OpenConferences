# Reviewer System Audit — Plain Language Report

**Date:** 20 September 2026
**Tested on:** Test_Conference (`test-conf`), local dev stack against the live Supabase database
**Accounts used:** platform admin (`ayush.balyan13@gmail.com`), reviewer (`hacklock.holmes@gmail.com`)
**ICAMCDS-2026 was never opened or modified.**

---

## The one-paragraph version

Your review system works. A reviewer can be invited, bid on papers, declare conflicts, get assigned a
paper, write a review, submit it, and read the author's rebuttal. A chair can run rounds, assign
reviewers, release reviews and record decisions. That is a real, working peer-review pipeline and
most of it behaved correctly when I drove it by hand.

But there is one bug that can silently destroy a reviewer's work, and there are several places where
the system does something and simply doesn't tell anyone. Those are the things that will hurt you
during a live conference, more than any missing feature.

---

## The serious problem: reviews can vanish without warning

### What happens

A reviewer opens their assigned paper, types a full review, and sees the words "Saving…" at the top
of the page. It stays on "Saving…" forever. If they close the tab or reload, **everything they wrote
is gone.** There is no error, no warning, no red text that stays on screen.

I reproduced this twice:

1. I typed a complete review and lost the whole thing.
2. After submitting a review, I changed my Originality score from 3 to 5. The screen kept showing 5.
   The saved score was still 3.

The second case is worse in practice. A reviewer changes their mind, sees the new score on screen,
walks away believing it is recorded, and the chair decides the paper using the old number.

### Why it happens

The review form is only allowed to save during certain phases of a round. If the round is in the
"Open" phase (before you press Advance), or if the review has already been submitted and the round
is not in "Rebuttal", the server refuses the save.

The server does send back a clear message — "Reviews cannot be edited in the current round phase".
The problem is what the page does with it. It treats that refusal as a temporary hiccup instead of a
firm "no", so it immediately tries again. Each retry wipes the error message off the screen before
you can read it, and puts the status back to "Saving…". You saw this yourself — the message flashed
up and then disappeared.

So the error handling exists. It just gets erased by the retry loop.

### How likely is this in real use

Very likely. It triggers in two completely ordinary situations:

- A chair assigns papers to reviewers **before** advancing the round to "Reviewing". This is a
  natural thing to do — you want assignments ready before you open the floodgates. Every reviewer who
  starts early will lose their work.
- A reviewer revises their review after submitting but before rebuttal opens. Reviewers do this all
  the time.

### What needs to change

Three things, in order of importance:

1. When the server says "you cannot edit right now", stop retrying, keep the message on screen, and
   grey out the form fields so nobody keeps typing into a void.
2. Disable the whole form automatically when the round phase doesn't allow editing, and show a short
   banner explaining why and when it will reopen.
3. Warn before leaving the page if there are unsaved changes.

---

## Other things that are broken

### Logging in tells you it failed when it worked

When I entered the correct two-factor code, the login genuinely succeeded — the server accepted it
and issued a session. But the page stayed on the code-entry screen with the button ready to press
again, as if nothing had happened. I only got in by typing a dashboard address manually.

A chair or reviewer hitting this will assume they typed the code wrong and request another one.

### "Remember me" and "Trust this device" do nothing

Both checkboxes are permanently ticked and cannot be unticked. I ticked "Trust this device" and was
still asked for a code the very next time I signed in. They are decorative.

### Things succeed with no confirmation

Granting someone a role worked correctly, but the screen gave no message, and the form kept the
values I had typed. I had to check the server logs to know it had worked. The same silence appears
in a few other places.

### Errors don't say what went wrong

When I tried to submit a paper without the right permission, the message was "Failed to create
submission". It did not say the account lacked an Author role. Someone without access to the logs
would have no idea what to fix.

### Nobody is told when an email fails

There is an email in your records — reviews being released to an author — that is marked **FAILED**.
That author never received their reviews. Nothing anywhere in the interface tells a chair this
happened. You would only discover it if the author complained.

### The PDF filename can give away the authors

Your system correctly hides author names from reviewers during bidding. But when a reviewer
downloads the paper, the file keeps its **original uploaded filename**. Authors routinely name files
things like `Smith_etal_final_v3.pdf`. That name goes straight to the reviewer and undoes the
anonymity you carefully protected everywhere else.

---

## What reviewers will find frustrating

### They cannot read the paper in the app

There is no PDF viewer. The only option is a Download button, which opens the file in another tab or
in a separate PDF app. So a reviewer is constantly switching between the paper and the form, with no
way to see both at once. Every established conference tool puts these side by side, because that is
the actual task.

### The review page doesn't tell them much

The review form shows the paper's title and nothing else. No abstract, no keywords, no page count,
and — surprisingly — **no due date**, even though the dashboard shows one. The heading of the page
is a long random ID code rather than the paper's name.

### They cannot say "this isn't for me"

If a reviewer is assigned a paper outside their expertise, there is no Decline button. They have to
email you and you have to fix it by hand. The capability is half-built — your database has a
"Declined" status — but nothing in the app can set it.

### The page contradicts itself

On "My reviews", the summary boxes at the top said "In progress: 1" while the row directly below
said "Not started". The dashboard button says "Continue review" for a review that was never begun.

### Bidding gives them very little to judge by

The bidding list shows a title and one truncated line of abstract. No keywords, no PDF, no search, no
filtering. Asking someone to bid on twenty papers from one line each will produce low-quality bids.

---

## What chairs will find frustrating

### You cannot tell who has done their review

The assignments table lists Paper, Reviewer, Email and Bid. It does not show whether the review is
finished, when it is due, or what score was given. So the one question a chair asks every day — "who
is behind?" — cannot be answered from this screen.

### There is no place to read the reviews

There is no page where a chair can sit down and read all the reviews for a paper together with the
reviewers' confidential comments. The decisions screen asks you to accept or reject without showing
you the reviews you are deciding on.

### You cannot give one reviewer an extension

Due dates come from the round. The assignment screen has no date field, so every reviewer on a round
gets the same deadline with no exceptions.

### Deadlines are decorative

Due dates are stored, displayed and emailed, but nothing enforces them. A review submitted three
weeks late is accepted without comment, as long as the round is still open. Related: the reminder
email only goes out to people whose review is due within the next three days, and it deliberately
skips anyone already overdue — so the moment someone is late, the system stops chasing them.

### You must show reviews to authors before you can decide

Once a round is in "Reviewing", the only available action is "Release reviews". There is no way to
move to the deciding stage without first publishing the reviews to authors. If you wanted to settle
borderline cases internally first, you cannot.

### Member lists show ID codes instead of useful information

The reviewers list shows a name next to a long random ID. No email, no affiliation. Granting a role
requires pasting one of those ID codes, which you have to go and find first.

---

## Features that don't exist yet

These are not bugs — they were never built. Whether they matter depends on the size of your
conference.

- **Automatic reviewer assignment.** Everything is manual. Bids are collected and shown, but nothing
  uses them to suggest or make assignments. At twenty papers this is fine. At two hundred it is many
  hours of clicking.
- **Reviewer discussion.** Reviewers cannot see each other's reviews or talk to each other. The
  standard "reviewers disagree, they discuss, a decision emerges" process has nowhere to happen.
- **Meta-reviews and area chairs.** There is no role between chair and reviewer, and no place to
  write a summary judgement of a paper's reviews.
- **Configurable review forms.** The three score boxes (originality, clarity, significance) are fixed
  in the code. There is a settings field for this in the database, but the form ignores it and there
  is no screen to edit it.
- **Conflict detection beyond the basics.** The system only catches a conflict if the author has a
  registered account on the platform and it is linked to the paper. It does not compare email
  addresses or institutions. If an author hasn't signed up, their own co-author could be assigned to
  review their paper.
- **Review attachments.** Reviewers cannot upload an annotated PDF or any supporting file.

---

## What I would fix first

If the conference is close, fix these five and you will avoid most of the pain:

1. **The silent save failure.** This loses reviewers' work. Nothing else comes close in severity.
2. **The two-factor login not redirecting.** Every chair hits this on every login.
3. **A chair page that shows review progress and lets you read reviews.** Without it you cannot
   actually run the committee.
4. **A PDF viewer beside the review form.** The single biggest quality-of-life change for reviewers.
5. **An assignment Decline button.** Otherwise every mismatch becomes an email to you.

After those, in rough order: show due dates in the review form, enforce deadlines on submit, fix the
"Remember me" and "Trust this device" checkboxes, add success confirmations, surface failed emails,
and strip original filenames from downloads.

---

## What was changed during this test

All inside Test_Conference. ICAMCDS-2026 was never opened.

- Granted an Author role to the admin account (turned out to be unnecessary — should be reverted)
- Opened Round 2 and advanced it to "Reviewing"
- Assigned "Test Submission 2" to the reviewer account
- Submitted one review as that reviewer
- One genuine email was sent, to `hacklock.holmes@gmail.com`

"Release reviews" and "Notify authors" were deliberately **not** used, because those send email to
paper authors.

A full database backup was taken before any of this, at
`~/openconferences-backups/oc-20260920-221230.dump` (538 KB, verified to contain all review tables).
