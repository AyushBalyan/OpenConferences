/** Local dummy API. Never imports production config, database, payment, or mail clients. */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { loadTestGateway } from './razorpay-test.mjs';
import { demoReceipt, demoInvoicePdf } from './receipts.mjs';
import {
  createState,
  coordination,
  reviewerOverview,
  analytics,
  conferenceId,
  organizerId,
  base,
} from './data.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const webPort = Number(process.env.DEMO_WEB_PORT ?? 3010);
const apiPort = Number(process.env.DEMO_API_PORT ?? 3011);
const authorView = process.env.DEMO_VIEW === 'author';
const testGateway = loadTestGateway(root);
function createViewState() {
  const current = createState();
  if (authorView) {
    const author = current.authors[0];
    current.user = {
      ...current.user,
      id: author.userId,
      name: `${author.name} · Demo Author`,
      email: author.email,
      twoFactorEnabled: false,
    };
    current.conference.myRoles = ['AUTHOR'];
    current.conference.name = 'ICACM 2026 · Dummy Author Demo';
    const underReview = current.papers[4];
    underReview.submittedById = author.userId;
    Object.assign(underReview.authorships[0], {
      userId: author.userId,
      fullName: author.name,
      email: author.email,
    });
    current.papers = current.papers
      .filter((paper) => paper.submittedById === author.userId)
      .map((paper) => ({
        ...paper,
        conferenceName: current.conference.name,
        conferenceSlug: current.conference.slug,
      }));
  }
  return current;
}
let state = process.env.DEMO_STATE_FILE
  ? JSON.parse(readFileSync(process.env.DEMO_STATE_FILE, 'utf8'))
  : createViewState();
const page = (data) => ({ data, nextCursor: null });
const now = () => new Date().toISOString();
const addAudit = (action, entity, entityId) =>
  state.audits.unshift({
    ...base,
    id: randomUUID(),
    actorUserId: organizerId,
    action,
    entity,
    entityId,
    createdAt: now(),
    diff: { demo: true },
  });
const update = (row, input) =>
  Object.assign(row, input, { updatedAt: now(), version: (row.version ?? 0) + 1 });
const find = (rows, key) => rows.find((row) => row.id === key);

function registrationQuote(registration) {
  const schedule = state.conference.feeSchedule;
  const timing =
    schedule.earlyBirdEndsAt && new Date() < new Date(schedule.earlyBirdEndsAt)
      ? 'EARLY'
      : 'REGULAR';
  const isAdditionalPaper =
    schedule.additionalPaperMinor !== undefined &&
    state.registrations.some(
      (r) =>
        r.id !== registration.id &&
        r.userId === registration.userId &&
        !r.isAdditionalPaper &&
        state.payments.some(
          (p) =>
            p.registrationId === r.id &&
            p.status === 'CAPTURED' &&
            p.amountMinor >= r.amountDueMinor,
        ),
    );
  const amount = isAdditionalPaper
    ? schedule.additionalPaperMinor
    : schedule.matrix[registration.audience][timing];
  const regular = isAdditionalPaper
    ? schedule.additionalPaperMinor
    : schedule.matrix.REGULAR[timing];
  const domestic = schedule.currency === 'USD' && registration.billingCountry === 'IN';
  if (domestic && !schedule.domesticInrPerUsd) {
    throw Object.assign(new Error('Configure the demo INR conversion rate first.'), {
      status: 400,
    });
  }
  return {
    amountMinor: Math.round(amount * (domestic ? schedule.domesticInrPerUsd : 1)),
    regularAmountMinor: Math.round(regular * (domestic ? schedule.domesticInrPerUsd : 1)),
    currency: domestic ? 'INR' : schedule.currency,
    timing,
    isAdditionalPaper,
  };
}

function registrationAffiliation(registration, paper) {
  return (
    registration.billingAffiliation?.trim() ||
    paper.authorships
      .find((a) => a.userId === registration.userId || (!a.userId && a.email === state.user.email))
      ?.affiliation?.trim() ||
    null
  );
}

export async function route(method, path, query, input = {}) {
  const get = method === 'GET';
  const parts = path.split('/').filter(Boolean);
  const end = parts.at(-1);
  if (path === '/__demo/reset' && method === 'POST') {
    state = createViewState();
    return { message: 'Dummy data reset', conferenceId };
  }
  if (path === '/__demo/state') return state;
  if (path === '/__demo/routes') return demoRoutes;
  if (path.startsWith('/auth')) {
    if (end === 'get-session' || end === 'sign-in')
      return {
        session: {
          id: 'demo-session',
          userId: state.user.id,
          token: 'local-demo-no-real-session',
          expiresAt: '2099-12-31T00:00:00.000Z',
        },
        user: state.user,
      };
    if (end === 'me') return state.user;
    if (end === 'dashboard')
      return {
        user: state.user,
        canCreateConference: !authorView,
        authorConferences: authorView ? [state.conference] : [],
        reviewerConferences: [],
        organizerConferences: authorView ? [] : [state.conference],
        authoredPapers: authorView ? state.papers : [],
        reviewerAssignments: [],
        pendingReviewerInvitations: [],
      };
    return { success: true, user: state.user };
  }
  if (path === '/me/dashboard')
    return {
      canCreateConference: !authorView,
      authorConferences: authorView ? [state.conference] : [],
      reviewerConferences: [],
      organizerConferences: authorView ? [] : [state.conference],
      authoredPapers: authorView ? state.papers : [],
      reviewerAssignments: [],
      pendingReviewerInvitations: [],
    };
  if (parts[0] === 'bot' && parts[1] === 'conferences' && parts[2] === conferenceId)
    return {
      data:
        parts[3] === 'papers'
          ? state.papers
          : parts[3] === 'reviewers'
            ? state.reviewers
            : parts[3] === 'assignments'
              ? state.assignments
              : state.authors,
      nextCursor: null,
      meta: { conferenceId, observedAt: now(), requestId: 'local-demo-request' },
    };
  if (path === '/organizations') return page([state.organization]);
  if (path === '/conferences') return page([state.conference]);
  if (parts[0] !== 'conferences' || parts[1] !== conferenceId) return null;
  const section = parts[2];
  if (!section) {
    if (!get) update(state.conference, input);
    return state.conference;
  }
  if (section === 'settings') {
    update(state.conference, input);
    addAudit('conference.settings_updated', 'Conference', conferenceId);
    return state.conference;
  }
  if (section === 'status') {
    update(state.conference, { status: input.status });
    return state.conference;
  }
  if (section === 'author-join-link')
    return {
      url: `http://localhost:${webPort}/conferences/join/demo-token`,
      token: '00000000-0000-4000-8000-000000000999',
      urlPath: '/join/author?token=00000000-0000-4000-8000-000000000999',
    };
  if (section === 'analytics') return analytics(state);
  if (section === 'review-coordination') return coordination(state);
  if (section === 'reviewer-overview') return reviewerOverview(state, query);
  if (section === 'review-progress') return { data: coordination(state).data, minimumReviews: 2 };
  if (section === 'inbox') {
    if (end === 'count') return { unreadCount: state.inbox.filter((x) => x.unread).length };
    if (!get) {
      state.inbox
        .filter((x) => end === 'read-all' || x.id === input.sourceId)
        .forEach((x) => (x.unread = false));
      return { read: true };
    }
    return {
      ...page(
        state.inbox.filter(
          (x) =>
            (!query.get('kind') || x.kind === query.get('kind')) &&
            (!query.get('unread') || x.unread),
        ),
      ),
      observedAt: now(),
    };
  }
  if (section === 'tracks') {
    if (get) return page(state.tracks);
    const row = find(state.tracks, parts[3]);
    if (method === 'DELETE') {
      state.tracks = state.tracks.filter((x) => x !== row);
      return { message: 'Dummy track deleted' };
    }
    if (row) return update(row, input);
    const next = { ...base, id: randomUUID(), ...input };
    state.tracks.push(next);
    addAudit('track.created', 'Track', next.id);
    return [201, next];
  }
  if (section === 'members') {
    if (get)
      return page(
        state.members.filter((m) => !query.get('role') || m.roles.includes(query.get('role'))),
      );
    let member = state.members.find((m) => m.userId === input.userId || m.email === input.email);
    if (!member) {
      member = {
        userId: randomUUID(),
        membershipId: randomUUID(),
        name: input.email.split('@')[0],
        email: input.email,
        scope: input.scope ?? 'CONFERENCE',
        roles: [],
      };
      state.members.push(member);
    }
    member.roles =
      end === 'revoke'
        ? member.roles.filter((r) => r !== input.role)
        : [...new Set([...member.roles, input.role])];
    addAudit(`role.${end}`, 'Membership', member.membershipId);
    return {
      member,
      message: `Role ${end === 'revoke' ? 'revoked' : 'granted'} in the local demo.`,
    };
  }
  if (section === 'audit-logs') return page(state.audits);
  if (section === 'notification-logs') {
    if (!get) {
      const row = find(state.logs, parts[3]);
      if (row) update(row, { status: 'QUEUED', error: null });
      return { logId: parts[3], message: 'Simulated resend queued. No email was sent.' };
    }
    return page(
      state.logs.filter(
        (r) =>
          (!query.get('status') || r.status === query.get('status')) &&
          (!query.get('templateKey') || r.templateKey === query.get('templateKey')) &&
          (!query.get('search') ||
            `${r.toEmail} ${r.subject}`.toLowerCase().includes(query.get('search').toLowerCase())),
      ),
    );
  }
  if (section === 'notification-templates') {
    if (get) return page(state.templates);
    const row = find(state.templates, parts[3]);
    if (row) return update(row, input);
    const next = { ...base, id: randomUUID(), ...input, bodyText: input.bodyText ?? null };
    state.templates.push(next);
    return [201, next];
  }
  if (section === 'rounds') {
    if (end === 'assignments') return page(state.assignments.filter((a) => a.roundId === parts[3]));
    if (end === 'bulk') return { data: [], failures: [], message: 'Dummy bulk decision saved' };
    if (end === 'notify') {
      state.decisions.forEach((d) => {
        if (!input.paperIds || input.paperIds.includes(d.paperId)) d.notifiedAt = now();
      });
      return {
        notifiedCount: input.paperIds?.length ?? 1,
        message: 'Author notifications simulated; no email sent.',
      };
    }
    if (end === 'copy-from-previous-round')
      return {
        createdCount: 0,
        skippedCount: 2,
        failures: [],
        previousRoundNumber: 1,
        message: 'Existing demo assignments retained',
      };
    if (parts.length > 3) {
      const row = find(state.rounds, parts[3]);
      if (row && !get) update(row, input);
      return row;
    }
    return page(
      state.rounds.filter((r) => !query.get('paperId') || r.paperId === query.get('paperId')),
    );
  }
  if (section === 'decisions') return page(state.decisions);
  if (section === 'bids') return page(state.bids);
  if (section === 'review' && end === 'paper-pool')
    return {
      ...page(
        state.papers
          .filter((p) => p.status !== 'WITHDRAWN')
          .map((p) => ({ ...p, myBid: null, bids: state.bids.filter((b) => b.paperId === p.id) })),
      ),
      blindingMode: 'DOUBLE',
      mode: 'oversight',
    };
  if (section === 'reviewer-invitations') {
    if (get && end === 'link')
      return {
        invitationId: parts[3],
        url: `http://localhost:${webPort}/reviewer-invite/accept?token=local-demo-token`,
        expiresAt: state.conference.reviewDueAt,
      };
    if (get) return page(state.invitations);
    const row = find(state.invitations, parts[3]);
    if (method === 'DELETE') {
      state.invitations = state.invitations.filter((r) => r !== row);
      return { message: 'Dummy invitation removed' };
    }
    if (row) return { invitation: row, message: 'Invitation simulated; no email sent.' };
    const next = {
      ...base,
      id: randomUUID(),
      ...input,
      status: 'PENDING',
      invitedById: organizerId,
      expiresAt: state.conference.reviewDueAt,
      acceptedAt: null,
    };
    state.invitations.unshift(next);
    return [201, { invitation: next, message: 'Dummy invitation created; no email sent.' }];
  }
  if (section === 'conflicts-of-interest') {
    if (get) return end === 'declare-targets' ? { data: state.papers } : page(state.conflicts);
    if (method === 'DELETE') {
      state.conflicts = state.conflicts.filter((c) => c.id !== parts[3]);
      return { message: 'Dummy conflict removed' };
    }
    const p = find(state.papers, input.paperId);
    const row = {
      ...base,
      id: randomUUID(),
      userId: organizerId,
      userName: state.user.name,
      withUserId: null,
      source: 'CHAIR',
      paperTitle: p?.title,
      ...input,
    };
    state.conflicts.push(row);
    return [201, row];
  }
  if (section === 'assignments') {
    const row = find(state.assignments, parts[3]);
    if (end === 'intervene') {
      if (input.action === 'EXTEND') update(row, { dueAt: input.dueAt, overdue: false });
      if (input.action === 'REPLACE') {
        const r = state.reviewers.find((r) => r.userId === input.reviewerUserId);
        update(row, {
          reviewerUserId: r.userId,
          reviewerName: r.name,
          reviewerEmail: r.email,
          reviewProgress: 'NOT_STARTED',
          workState: 'NOT_STARTED',
        });
      }
      return {
        assignmentId: row.id,
        message: 'Demo assignment updated. Email delivery is simulated.',
      };
    }
    if (method === 'DELETE') {
      state.assignments = state.assignments.filter((a) => a !== row);
      return { message: 'Dummy assignment removed' };
    }
    return row;
  }
  if (section === 'reviewers' && end === 'preview') {
    const r = state.reviewers.find((r) => r.userId === parts[3]);
    return {
      templateId: state.templates[4].id,
      templateVersion: 1,
      recipient: r.email,
      reviewerName: r.name,
      conferenceName: state.conference.name,
      reviewUrl: `http://localhost:${webPort}`,
      items: input.assignments.map((a) => find(state.assignments, a.id)),
      subject: 'Demo review reminder',
      html: '<h2>Local demo reminder</h2><p>No email will be sent.</p>',
      text: 'Local demo reminder',
      preparedAt: now(),
      previewToken: 'a'.repeat(64),
      dailyLimit: 'One simulated reminder per day',
    };
  }
  if (section === 'reviewers' && end === 'reminders')
    return {
      digestId: randomUUID(),
      status: 'QUEUED',
      alreadyRequested: false,
      assignmentCount: input.assignments.length,
      notificationLogId: null,
      message: 'Reminder simulated locally. No email sent.',
    };
  if (section === 'registrations') {
    const row = find(state.registrations, parts[3]);
    if (end === 'refund') {
      update(row, { status: 'REFUNDED' });
      addAudit('payment.refunded', 'Registration', row.id);
      return { registration: row, message: 'Dummy refund recorded. No funds moved.' };
    }
    if (end === 'extend-deadline') {
      update(row, { deadlineAt: input.deadlineAt });
      return { registration: row, message: 'Dummy deadline updated' };
    }
    return page(
      state.registrations.filter(
        (r) =>
          (!query.get('audience') || r.audience === query.get('audience')) &&
          (!query.get('status') || query.get('status') === 'paid'
            ? !query.get('status') || r.status === 'PAID'
            : query.get('status') === 'unpaid'
              ? r.status !== 'PAID'
              : query.get('status') === 'at-risk'
                ? r.status === 'ADDITIONAL_PAYMENT_REQUIRED'
                : r.status === query.get('status')),
      ),
    );
  }
  if (section === 'student-verifications') {
    if (get) return page(state.verifications);
    const row = find(state.verifications, parts[3]);
    update(row, {
      status: { APPROVE: 'APPROVED', REJECT: 'REJECTED', CLARIFY: 'CLARIFICATION_REQUESTED' }[
        input.action
      ],
      reviewedAt: now(),
      reviewedById: organizerId,
      note: input.note ?? null,
    });
    const registration = find(state.registrations, row.registrationId);
    update(registration, {
      status:
        input.action === 'APPROVE'
          ? 'PAID'
          : input.action === 'REJECT'
            ? 'ADDITIONAL_PAYMENT_REQUIRED'
            : registration.status,
    });
    addAudit('student_verification.reviewed', 'StudentVerification', row.id);
    return { registration, message: 'Dummy verification updated' };
  }
  if (section === 'papers') {
    if (parts.length === 3)
      return page(
        state.papers.filter(
          (p) =>
            (!query.get('status') || p.status === query.get('status')) &&
            (!query.get('trackId') || p.trackId === query.get('trackId')),
        ),
      );
    const paper = find(state.papers, parts[3]);
    if (!paper) return null;
    if (end === paper.id) return paper;
    if (end === 'reviews') return page(state.reviews.filter((r) => r.paperId === paper.id));
    if (end === 'decision') {
      if (get)
        return (
          state.decisions.find((d) => d.paperId === paper.id) ?? [
            404,
            { detail: 'No decision recorded yet' },
          ]
        );
      const decision = {
        ...base,
        id: randomUUID(),
        paperId: paper.id,
        paperTitle: paper.title,
        submissionNumber: paper.submissionNumber,
        roundId: paper.latestCycleId,
        roundNumber: 1,
        decidedById: organizerId,
        ...input,
        notifiedAt: input.notify === false ? null : now(),
      };
      state.decisions = state.decisions.filter((d) => d.paperId !== paper.id);
      state.decisions.push(decision);
      update(paper, { status: 'DECISION_MADE' });
      return [201, { decision, warnings: [], nextRound: null, message: 'Dummy decision recorded' }];
    }
    if (end === 'rebuttal')
      return {
        ...base,
        id: randomUUID(),
        paperId: paper.id,
        roundId: paper.latestCycleId,
        body: 'Thank you for the constructive feedback. We have expanded the experiments and clarified our limitations in the revised manuscript.',
        submittedAt: now(),
      };
    if (end === 'assignments') {
      const reviewer = state.reviewers.find((r) => r.userId === input.reviewerUserId);
      const assignment = {
        ...state.assignments[0],
        id: randomUUID(),
        paperId: paper.id,
        paperTitle: paper.title,
        roundId: input.roundId ?? paper.latestCycleId,
        reviewerUserId: reviewer.userId,
        reviewerName: reviewer.name,
        reviewerEmail: reviewer.email,
        reviewProgress: 'NOT_STARTED',
        status: 'ASSIGNED',
        dueAt: input.dueAt ?? state.conference.reviewDueAt,
      };
      state.assignments.push(assignment);
      return [201, { assignment, message: 'Dummy reviewer assigned' }];
    }
    if (end === 'release') {
      update(find(state.rounds, paper.latestCycleId), { reviewsReleasedAt: now() });
      return { message: 'Dummy reviews released', publishedCount: 2 };
    }
    if (end === 'invoice') {
      const registration = state.registrations.find((r) => r.paperId === paper.id);
      const captured = state.payments.findLast(
        (p) =>
          p.registrationId === registration?.id && p.status === 'CAPTURED' && p.kind !== 'REFUND',
      );
      const receipt = captured && demoReceipt(state, captured, apiPort, webPort);
      return receipt ? receipt.invoice : [404, { detail: 'No captured payment invoice yet.' }];
    }
    if (end === 'download')
      return {
        downloadUrl: `http://localhost:${apiPort}/__demo/paper.pdf`,
        expiresInSeconds: 900,
        id: randomUUID(),
        paymentId: randomUUID(),
        number: 'DEMO-2026-001',
        issuedAt: now(),
      };
    if (parts.includes('registration')) {
      const registration = state.registrations.find((r) => r.paperId === paper.id);
      if (!get && testGateway && (end === 'payment' || end === 'verify')) {
        const accepted = state.decisions.some(
          (d) => d.paperId === paper.id && d.outcome === 'ACCEPT' && d.notifiedAt,
        );
        if (!registration || !accepted || (authorView && paper.submittedById !== state.user.id))
          return [403, { detail: 'Only your accepted demo papers can be registered.' }];
        if (end === 'verify') {
          const payment = state.payments.find(
            (p) =>
              p.registrationId === registration.id && p.providerOrderId === input.razorpay_order_id,
          );
          if (!payment || payment.providerOrderId.startsWith('order_demo'))
            return [400, { detail: 'Unknown test payment order.' }];
          const result = await testGateway.verify(payment, input);
          update(payment, {
            providerPaymentId: result.paymentId,
            status: result.captured ? 'CAPTURED' : 'AUTHORIZED',
          });
          if (result.captured)
            update(registration, {
              status:
                registration.audience === 'STUDENT' &&
                !state.verifications.some(
                  (v) => v.registrationId === registration.id && v.status === 'APPROVED',
                )
                  ? 'AWAITING_VERIFICATION'
                  : 'PAID',
            });
          return { verified: true, captured: result.captured, registration };
        }
        if (registration.status === 'PAID')
          return [400, { detail: 'This demo paper is already paid.' }];
        const affiliation = registrationAffiliation(registration, paper);
        if (!affiliation)
          return [422, { detail: 'Enter your affiliation for the invoice before payment.' }];
        const quote = registrationQuote(registration);
        const order = await testGateway.createOrder(quote.amountMinor, quote.currency);
        update(registration, {
          billingAffiliation: affiliation,
          amountDueMinor: quote.amountMinor,
          currency: quote.currency,
          lockedTiming: quote.timing,
          isAdditionalPaper: quote.isAdditionalPaper,
        });
        const payment = {
          ...base,
          id: randomUUID(),
          registrationId: registration.id,
          provider: 'razorpay',
          providerOrderId: order.id,
          providerPaymentId: null,
          status: 'CREATED',
          amountMinor: quote.amountMinor,
          currency: quote.currency,
          kind: 'INITIAL',
          createdAt: now(),
          updatedAt: now(),
        };
        state.payments.push(payment);
        return {
          paymentId: payment.id,
          provider: 'razorpay',
          keyId: testGateway.keyId,
          orderId: order.id,
          amountMinor: payment.amountMinor,
          currency: payment.currency,
          registration,
        };
      }
      if (!get && registration && end === 'registration') {
        const affiliation =
          input.billingAffiliation?.trim() || registrationAffiliation(registration, paper);
        if (!affiliation || affiliation.length > 300)
          return [
            422,
            { detail: 'Enter your institution or organization (up to 300 characters).' },
          ];
        input.billingAffiliation = affiliation;
        update(registration, input);
        return [201, registration];
      }
      if (!get && registration && end === 'payment')
        return {
          paymentId: randomUUID(),
          provider: 'mock',
          keyId: 'mock_key_id',
          orderId: 'order_demo',
          amountMinor: registration.amountDueMinor,
          currency: registration.currency,
          registration,
        };
      return registration
        ? {
            ...registration,
            billingAffiliation: registrationAffiliation(registration, paper),
            payments: state.payments.filter((p) => p.registrationId === registration.id),
            latestVerification:
              state.verifications.find((v) => v.registrationId === registration.id) ?? null,
            feeSchedule: state.conference.feeSchedule,
            earlyBirdEndsAt: state.conference.feeSchedule.earlyBirdEndsAt,
            paymentQuote: !registration.lockedTiming ? registrationQuote(registration) : null,
            invoice: (() => {
              const captured = state.payments.findLast(
                (p) =>
                  p.registrationId === registration.id &&
                  p.status === 'CAPTURED' &&
                  p.kind !== 'REFUND',
              );
              return captured
                ? (demoReceipt(state, captured, apiPort, webPort)?.invoice ?? null)
                : null;
            })(),
          }
        : [404, { detail: 'No registration' }];
    }
  }
  if (section === 'integrations') {
    if (end === 'access')
      return page([
        {
          id: randomUUID(),
          requestId: 'demo-request',
          route: '/papers',
          method: 'GET',
          status: 200,
          resultCount: 12,
          durationMs: 24,
          observedAt: now(),
        },
      ]);
    const row = find(state.integrations, parts[3]);
    if (get) return row ?? page(state.integrations);
    if (end === 'keys') {
      const key = {
        id: randomUUID(),
        ...input,
        createdAt: now(),
        expiresAt: state.conference.registrationDueAt,
        revokedAt: null,
        lastUsedAt: null,
      };
      row.keys.push(key);
      return [201, { key, secret: 'demo_local_nonfunctional_key', integration: row }];
    }
    if (end === 'revoke') {
      if (parts.includes('keys')) find(row.keys, parts[5]).revokedAt = now();
      else update(row, { status: 'REVOKED' });
      return row;
    }
    if (row) return update(row, input);
    const next = { ...state.integrations[0], id: randomUUID(), ...input, keys: [] };
    state.integrations.push(next);
    return [201, next];
  }
  if (section === 'outreach') {
    if (end === 'sender')
      return {
        fromName: 'ICACM Demo Committee',
        fromEmail: 'committee@example.test',
        replyToEmail: 'organizer@example.test',
        configured: true,
        provider: 'log',
      };
    if (end === 'templates') return { data: state.outreachTemplates };
    const campaign = find(state.campaigns, parts[4]);
    if (end === 'preview') {
      const recipient = state.recipients.find(
        (r) => r.id === query.get('recipientId') || r.campaignId === campaign.id,
      );
      return {
        recipientId: recipient.id,
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        subject: campaign.subject,
        bodyHtml: campaign.bodyHtml
          .replaceAll('{{name}}', recipient.name)
          .replaceAll('{{topic}}', recipient.topic),
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        replyToEmail: campaign.replyToEmail,
      };
    }
    if (end === 'recipients') {
      if (get) return page(state.recipients.filter((r) => r.campaignId === campaign.id));
      const rows = input.rows.map((r) => ({
        ...r,
        id: randomUUID(),
        campaignId: campaign.id,
        status: 'PENDING',
        createdAt: now(),
        sentAt: null,
        deliveredAt: null,
        error: null,
        providerMessageId: null,
      }));
      state.recipients.push(...rows);
      campaign.recipientCount += rows.length;
      return { campaign, importedCount: rows.length, duplicateCount: 0, invalidRows: [] };
    }
    if (end === 'template') {
      const t = find(state.outreachTemplates, input.templateId);
      return update(campaign, {
        templateId: t.id,
        templateName: t.name,
        templateKey: t.key,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        status: 'READY',
      });
    }
    if (end === 'send') {
      update(campaign, { status: 'SENT', sentCount: campaign.recipientCount, sentAt: now() });
      return { campaign, message: 'Campaign simulated locally. No emails sent.' };
    }
    if (campaign) return campaign;
    if (get) return page(state.campaigns);
    const next = {
      ...state.campaigns[2],
      id: randomUUID(),
      ...input,
      recipientCount: 0,
      sentCount: 0,
      status: 'DRAFT',
    };
    state.campaigns.unshift(next);
    return [201, next];
  }
  return null;
}

export const demoRoutes = [
  '',
  'inbox',
  'submissions',
  'analytics',
  'reviews/bidding',
  'reviews/coi/all',
  'reviews/coi/declare',
  'reviews/rounds',
  'reviews/reviewers',
  'reviews/assignments/current',
  'reviews/assignments/bids',
  'reviews/assignments/invites',
  'reviews/assignments/manual',
  'reviews/decisions/pending',
  'reviews/decisions/recorded',
  'registrations/all',
  'registrations/verifications',
  'settings/phases',
  'settings/fees',
  'settings/integrations',
  'tracks',
  'members/organisers',
  'members/reviewers',
  'members/authors',
  'members/grant',
  'outreach',
  'notifications',
  'notifications/templates',
  'audit',
].map((suffix) => `/dashboard/conferences/${conferenceId}${suffix ? '/' + suffix : ''}`);

function pdf() {
  const text =
    'BT /F1 20 Tf 60 740 Td (ICACM 2026 - DUMMY DOCUMENT) Tj 0 -40 Td /F1 12 Tf (Local organizer demo. Fictional content for testing only.) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let result = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(result));
    result += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(result);
  result += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n `)
    .join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return result;
}
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ![`http://localhost:${webPort}`, `http://127.0.0.1:${webPort}`].includes(origin)) {
    res.writeHead(403);
    res.end('Local demo origin required');
    return;
  }
  res.setHeader('Access-Control-Allow-Origin', origin ?? `http://localhost:${webPort}`);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'content-type,idempotency-key,x-request-id,authorization',
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url, `http://localhost:${apiPort}`);
  if (url.pathname === '/__demo/paper.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.end(pdf());
    return;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    const receiptPath = url.pathname.match(
      /^\/__demo\/(invoices|payment-emails)\/([a-f0-9-]+)(\.pdf)?$/,
    );
    if (req.method === 'GET' && receiptPath) {
      const payment = state.payments.find((p) => p.id === receiptPath[2]);
      const receipt = payment && demoReceipt(state, payment, apiPort, webPort);
      if (!receipt) {
        res.writeHead(404);
        res.end('Captured demo payment not found');
        return;
      }
      const invoice = receiptPath[1] === 'invoices';
      res.setHeader('Content-Type', invoice ? 'application/pdf' : 'text/html; charset=utf-8');
      if (invoice)
        res.setHeader('Content-Disposition', `inline; filename="${receipt.invoice.number}.pdf"`);
      res.end(invoice ? await demoInvoicePdf(receipt) : receipt.html);
      return;
    }
    const input = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const output = await route(
      req.method,
      url.pathname.replace(/^\/api\/v1/, ''),
      url.searchParams,
      input,
    );
    const [status, data] =
      Array.isArray(output) && typeof output[0] === 'number'
        ? output
        : [
            output == null ? 404 : 200,
            output ?? { detail: 'This local demo endpoint is not implemented', path: url.pathname },
          ];
    if (status === 404) console.log('UNHANDLED', req.method, url.pathname);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  } catch (error) {
    console.error('DEMO API ERROR', req.method, url.pathname, error.message);
    res.writeHead(error.status ?? 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: `Dummy API error: ${error.message}` }));
  }
});
server.listen(apiPort, '127.0.0.1', () =>
  console.log(`Dummy API: http://localhost:${apiPort} (local memory only)`),
);
let web;
if (!process.argv.includes('--api-only')) {
  web = spawn(
    'pnpm',
    [
      '--filter',
      '@openconferences/web',
      'exec',
      'next',
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      String(webPort),
    ],
    {
      cwd: root,
      stdio: 'inherit',
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        SKIP_ENV_FILE: 'true',
        NEXT_DIST_DIR: process.env.DEMO_DIST_DIR ?? '.next-browser-tests',
        NEXT_PUBLIC_API_URL: `http://localhost:${apiPort}/api/v1`,
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
      },
    },
  );
  web.on('exit', (code) => {
    server.close();
    process.exitCode = code ?? 0;
  });
}
console.log(
  `${authorView ? 'Author' : 'Organizer'} demo: http://localhost:${webPort}/dashboard/conferences/${conferenceId}`,
);
console.log(
  testGateway
    ? 'Razorpay TEST checkout enabled. Data remains local; email delivery is simulated.'
    : 'Dummy state resets on restart. Payments and email delivery are simulated.',
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    if (web?.pid) {
      try {
        // pnpm launches Next as a child; stop the entire demo process group.
        if (process.platform !== 'win32') process.kill(-web.pid, signal);
        else web.kill(signal);
      } catch {
        /* The child may already have exited. */
      }
    }
    server.close(() => process.exit(0));
  });
