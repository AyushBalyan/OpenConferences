import {
  aggregateReviewerWorkload,
  CONFERENCE_2026_FEES,
} from '../../../packages/schemas/dist/index.js';

export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const conferenceId = id(1);
export const organizerId = id(2);
const orgId = id(3);
const createdAt = '2026-10-01T09:00:00.000Z';
export const base = {
  organizationId: orgId,
  conferenceId,
  createdAt,
  updatedAt: createdAt,
  version: 1,
};
const iso = (day) => `2026-11-${String(day).padStart(2, '0')}T12:00:00.000Z`;
const names = [
  'Aarav Mehta',
  'Maya Chen',
  'Sofia Martinez',
  'Priya Nair',
  'Daniel Wilson',
  'Amina Hassan',
  'Kenji Sato',
  'Lena Fischer',
  'Rohan Kapoor',
  'Emma Clarke',
  'Noah Williams',
  'Ananya Rao',
];
const institutions = [
  'Demo Institute of Technology, Delhi',
  'Pacific Research University',
  'Iberia Technical Institute',
  'South Coast Institute of Science',
];
const titles = [
  'Reliable Federated Learning for Healthcare Networks',
  'Privacy-Preserving Analytics in Smart Cities',
  'Low-Resource Language Models for Public Services',
  'Energy-Aware Scheduling in Distributed Systems',
  'Explainable Machine Learning for Climate Forecasting',
  'Secure Identity Management for Digital Campuses',
  'Human-Centered Evaluation of Generative AI Tools',
  'Resilient Edge Computing for Disaster Response',
  'Fairness Audits for Automated Decision Systems',
  'Graph-Based Methods for Scientific Discovery',
  'Robust Multimodal Models for Accessibility',
  'Sustainable Data Infrastructure for Research Labs',
];

export function createState() {
  const user = {
    id: organizerId,
    name: 'Dr. Kavya Sharma · Demo Organizer',
    email: 'organizer@example.test',
    emailVerified: true,
    twoFactorEnabled: true,
    hasPassword: true,
    needsProfileSetup: false,
    image: null,
    createdAt,
  };
  const conference = {
    ...base,
    id: conferenceId,
    slug: 'icacm-2026-demo',
    name: 'ICACM 2026 · Dummy Organizer Demo',
    status: 'FINALIZATION',
    blindingMode: 'DOUBLE',
    myRoles: ['ORGANIZER'],
    authorJoinToken: id(999),
    cfpOpensAt: '2026-08-01T00:00:00.000Z',
    cfpClosesAt: '2026-10-25T18:30:00.000Z',
    biddingOpensAt: '2026-10-01T00:00:00.000Z',
    biddingClosesAt: '2026-11-10T18:30:00.000Z',
    reviewDueAt: iso(12),
    rebuttalDueAt: iso(14),
    decisionDueAt: iso(16),
    cameraReadyDueAt: iso(25),
    registrationDueAt: iso(30),
    reviewConfig: {
      scoreDimensions: ['originality', 'clarity', 'significance'],
      recommendationRequired: true,
      confidenceRequired: true,
      minimumReviews: 2,
    },
    feeSchedule: {
      ...structuredClone(CONFERENCE_2026_FEES),
      domesticInrPerUsd: 85,
      registrationDeadlineAt: iso(30),
    },
  };
  const tracks = [
    'Artificial Intelligence & Applications',
    'Distributed Systems & Security',
    'Sustainable Computing',
  ].map((name, i) => ({
    ...base,
    id: id(10 + i),
    name,
    slug: ['ai', 'systems', 'sustainability'][i],
    description: [
      'Learning systems, language technology, and responsible AI.',
      'Scalable systems, privacy, networking, and cybersecurity.',
      'Energy-efficient infrastructure and computing for society.',
    ][i],
  }));
  const reviewers = [
    'Dr. Ada Menon',
    'Prof. James Liu',
    'Dr. Sara Ahmed',
    'Prof. Miguel Costa',
    'Dr. Hana Kim',
    'Dr. Omar Farouk',
    'Prof. Elena Rossi',
    'Dr. Grace Okafor',
  ].map((name, i) => ({
    userId: id(50 + i),
    name,
    email: `reviewer${i + 1}@example.test`,
    roles: ['REVIEWER'],
    membershipId: id(80 + i),
    scope: 'CONFERENCE',
  }));
  const authors = names.map((name, i) => ({
    userId: id(100 + i),
    name,
    email: `author${i + 1}@example.test`,
    roles: ['AUTHOR'],
    membershipId: id(130 + i),
    scope: 'CONFERENCE',
  }));
  const members = [
    {
      userId: organizerId,
      name: user.name,
      email: user.email,
      roles: ['ORGANIZER'],
      scope: 'CONFERENCE',
      membershipId: id(20),
    },
    {
      userId: id(21),
      name: 'Prof. Arjun Sen · Demo Chair',
      email: 'chair@example.test',
      roles: ['CHAIR'],
      scope: 'CONFERENCE',
      membershipId: id(22),
    },
    ...reviewers,
    ...authors,
  ];
  const statuses = [
    'DECISION_MADE',
    'CAMERA_READY',
    'DECISION_MADE',
    'DECISION_MADE',
    'UNDER_REVIEW',
    'UNDER_REVIEW',
    'UNDER_REVIEW',
    'SUBMITTED',
    'DECISION_MADE',
    'UNDER_REVIEW',
    'CAMERA_READY',
    'WITHDRAWN',
  ];
  const papers = titles.map((title, i) => ({
    ...base,
    id: id(200 + i),
    title,
    submissionNumber: `ICACM-${['7M4K', '8N5P', '2Q6R', '3S7T', '4U8V', '5W9X', '6Y2Z', '7A3B', '8C4D', '9E5F', '2G6H', '3J7K'][i]}`,
    abstract: `This dummy submission studies ${title.toLowerCase()}. We present a reproducible method, evaluate it against established baselines, and discuss practical implications for researchers and practitioners. All authors, results, and manuscript details in this local demonstration are fictional.`,
    trackId: tracks[i % 3].id,
    status: statuses[i],
    submittedById: authors[i].userId,
    keywords: [
      'reproducibility',
      ['machine learning', 'distributed systems', 'sustainability'][i % 3],
    ],
    submittedAt: `2026-10-${String(10 + i).padStart(2, '0')}T09:30:00.000Z`,
    currentVersionId: id(300 + i),
    latestCycleId: id(400 + i),
    version: 2,
    authorships: [
      {
        id: id(500 + i),
        paperId: id(200 + i),
        userId: authors[i].userId,
        fullName: authors[i].name,
        email: authors[i].email,
        affiliation: institutions[i % 4],
        country: ['IN', 'US', 'ES', 'IN'][i % 4],
        order: 1,
        isCorresponding: true,
      },
    ],
    currentVersion: {
      id: id(300 + i),
      paperId: id(200 + i),
      kind: 'SUBMISSION',
      versionNumber: 1,
      createdAt,
      fileAsset: {
        id: id(350 + i),
        originalFilename: `ICACM-demo-${i + 1}.pdf`,
        mimeType: 'application/pdf',
        scanStatus: 'CLEAN',
        sizeBytes: 184532,
      },
    },
    cameraReadyVersion:
      statuses[i] === 'CAMERA_READY'
        ? {
            id: id(600 + i),
            kind: 'CAMERA_READY',
            versionNumber: 1,
            fileAsset: {
              id: id(650 + i),
              originalFilename: `ICACM-demo-${i + 1}-final.pdf`,
              scanStatus: 'CLEAN',
              mimeType: 'application/pdf',
            },
          }
        : null,
  }));
  for (const paper of papers) {
    for (const author of paper.authorships)
      Object.assign(author, { createdAt, updatedAt: createdAt });
    for (const version of [paper.currentVersion, paper.cameraReadyVersion].filter(Boolean)) {
      Object.assign(version, {
        paperId: paper.id,
        fileAssetId: version.fileAsset.id,
        uploadedById: paper.submittedById,
        note: 'Fictional document for local demo testing.',
        createdAt,
      });
      Object.assign(version.fileAsset, {
        bucket: 'local-demo',
        objectKey: `demo/${version.id}.pdf`,
        sizeBytes: '184532',
        checksumSha256: '0'.repeat(64),
        createdAt,
        updatedAt: createdAt,
      });
    }
  }
  // The same author has a paid base paper and a later accepted additional paper.
  papers[2].submittedById = authors[0].userId;
  Object.assign(papers[2].authorships[0], {
    userId: authors[0].userId,
    fullName: authors[0].name,
    email: authors[0].email,
  });
  const rounds = papers.map((p, i) => ({
    ...base,
    id: p.latestCycleId,
    paperId: p.id,
    submissionNumber: p.submissionNumber,
    roundNumber: i === 5 ? 2 : 1,
    reviewStage: i < 4 || i === 8 || i === 10 ? 'DECIDED' : 'IN_REVIEW',
    reviewDueAt: iso(12),
    rebuttalDueAt: iso(14),
    revisionDueAt: iso(18),
    reviewsReleasedAt: i < 4 ? iso(1) : null,
  }));
  const assignments = papers
    .filter((p) => p.status !== 'WITHDRAWN')
    .flatMap((paper, i) =>
      Array.from({ length: i === 7 ? 1 : 2 }, (_, j) => {
        const reviewer = reviewers[(i + j) % reviewers.length];
        const completed = i < 4 || i === 8 || i === 10 || i === 9 || (i === 4 && j === 0);
        const draft = !completed && (i + j) % 2 === 0;
        return {
          ...base,
          id: id(700 + i * 3 + j),
          paperId: paper.id,
          paperTitle: paper.title,
          paperSubmittedAt: paper.submittedAt,
          submissionNumber: paper.submissionNumber,
          roundId: paper.latestCycleId,
          reviewerUserId: reviewer.userId,
          reviewerName: reviewer.name,
          reviewerEmail: reviewer.email,
          status: completed ? 'COMPLETED' : 'ASSIGNED',
          dueAt: completed ? iso(8) : i === 6 ? iso(1) : iso(5),
          reviewProgress: completed ? 'SUBMITTED' : draft ? 'DRAFT' : 'NOT_STARTED',
          overdue: i === 6,
          bidValue: j === 0 ? 'EAGER' : 'YES',
          trackId: paper.trackId,
          trackName: tracks[i % 3].name,
          roundNumber: rounds[i].roundNumber,
          isCurrentCycle: true,
          paperStatus: paper.status,
          canIntervene: !completed,
          workState: completed ? 'SUBMITTED' : draft ? 'DRAFT' : 'NOT_STARTED',
          dueSoon: !completed && i !== 6,
        };
      }),
    );
  const reviews = assignments
    .filter((a) => a.reviewProgress !== 'NOT_STARTED')
    .map((a, i) => ({
      ...base,
      id: id(800 + i),
      assignmentId: a.id,
      roundId: a.roundId,
      roundNumber: a.roundNumber,
      paperId: a.paperId,
      reviewerUserId: a.reviewerUserId,
      reviewerName: a.reviewerName,
      reviewerEmail: a.reviewerEmail,
      paperTitle: a.paperTitle,
      scores: { originality: 4, clarity: i % 2 ? 3 : 4, significance: 4 },
      recommendation: i % 5 === 0 ? 'WEAK_ACCEPT' : 'ACCEPT',
      confidence: 4,
      commentsToAuthors:
        'The paper addresses an important problem with a clear methodology. Please expand the ablation analysis and clarify the limitations of the dataset.',
      commentsToChairs: 'Dummy review for local workflow testing.',
      visibility: 'AUTHOR_VISIBLE',
      submittedAt: a.reviewProgress === 'SUBMITTED' ? iso(1) : null,
      canEdit: true,
      hasPendingEdit: false,
    }));
  const decisions = [0, 1, 2, 3, 8, 10].map((i, j) => ({
    ...base,
    id: id(900 + i),
    paperId: papers[i].id,
    paperTitle: papers[i].title,
    paperSubmittedAt: papers[i].submittedAt,
    submissionNumber: papers[i].submissionNumber,
    roundId: rounds[i].id,
    roundNumber: rounds[i].roundNumber,
    decidedById: organizerId,
    outcome: i === 8 ? 'REJECT' : 'ACCEPT',
    rationale:
      i === 8
        ? 'The contribution requires a broader evaluation before publication.'
        : 'Accepted following two positive reviews. Please address the reviewer comments in the final manuscript.',
    notifiedAt: j === 4 ? null : iso(1),
  }));
  const registrations = [0, 1, 2, 3, 10].map((i, j) => ({
    ...base,
    id: id(1000 + i),
    paperId: papers[i].id,
    paperTitle: papers[i].title,
    paperSubmittedAt: papers[i].submittedAt,
    userId: papers[i].submittedById,
    audience: i === 1 || i === 10 ? 'STUDENT' : 'REGULAR',
    status: ['PAID', 'AWAITING_VERIFICATION', 'PENDING', 'ADDITIONAL_PAYMENT_REQUIRED', 'PAID'][j],
    currency: i === 0 || i === 2 ? 'INR' : 'USD',
    billingCountry: i === 0 || i === 2 ? 'IN' : 'US',
    amountDueMinor: i === 2 ? 425000 : i === 0 ? 1062500 : i === 1 || i === 10 ? 7500 : 12500,
    lockedTiming: j === 2 ? null : 'EARLY',
    isAdditionalPaper: i === 2,
    windowOpensAt: iso(1),
    deadlineAt: iso(30),
    additionalGraceUntil: null,
  }));
  const payments = registrations
    .filter((r) => r.status !== 'PENDING')
    .map((r, i) => ({
      ...base,
      id: id(1100 + i),
      registrationId: r.id,
      provider: 'razorpay',
      providerOrderId: `order_demo${i + 1}`,
      providerPaymentId: `pay_demo${i + 1}`,
      status: 'CAPTURED',
      amountMinor: r.status === 'ADDITIONAL_PAYMENT_REQUIRED' ? 7500 : r.amountDueMinor,
      currency: r.currency,
      kind: 'INITIAL',
    }));
  const verifications = [1, 10].map((i, j) => ({
    ...base,
    id: id(1200 + i),
    registrationId: id(1000 + i),
    paperTitle: papers[i].title,
    paperSubmittedAt: papers[i].submittedAt,
    registrationAudience: 'STUDENT',
    fileAssetId: id(1250 + i),
    reviewedById: j ? organizerId : null,
    status: j ? 'APPROVED' : 'PENDING',
    note: j ? 'Enrollment valid for the 2026 academic year.' : null,
    submittedAt: iso(1),
    reviewedAt: j ? iso(2) : null,
  }));
  const bids = assignments.map((a, i) => ({
    ...base,
    id: id(1300 + i),
    paperId: a.paperId,
    paperTitle: a.paperTitle,
    paperSubmittedAt: a.paperSubmittedAt,
    submissionNumber: a.submissionNumber,
    reviewerUserId: a.reviewerUserId,
    reviewerName: a.reviewerName,
    reviewerEmail: a.reviewerEmail,
    value: a.bidValue,
  }));
  const conflicts = [
    {
      ...base,
      id: id(1400),
      userId: reviewers[1].userId,
      reviewerName: reviewers[1].name,
      userName: reviewers[1].name,
      userEmail: reviewers[1].email,
      paperId: papers[0].id,
      paperTitle: papers[0].title,
      withUserId: authors[0].userId,
      type: 'CO_AUTHOR',
      source: 'SELF',
      note: 'Coauthored a publication within the last three years (dummy declaration).',
    },
    {
      ...base,
      id: id(1401),
      userId: reviewers[3].userId,
      reviewerName: reviewers[3].name,
      userName: reviewers[3].name,
      userEmail: reviewers[3].email,
      paperId: papers[2].id,
      paperTitle: papers[2].title,
      withUserId: null,
      type: 'INSTITUTION',
      source: 'CHAIR',
      note: 'Same institutional affiliation (dummy declaration).',
    },
  ];
  const invitations = ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'].map((status, i) => ({
    ...base,
    id: id(1500 + i),
    email: `invited-reviewer${i + 1}@example.test`,
    name: ['Dr. Oliver Green', 'Prof. Mei Lin', 'Dr. Nadia Ali', 'Dr. Thomas Reed'][i],
    invitedById: organizerId,
    invitedUserId: i === 1 ? reviewers[1].userId : null,
    roleNote: 'Demo invitation to the technical program committee',
    reviewerUserId: i === 1 ? reviewers[1].userId : null,
    status,
    expiresAt: iso(15),
    acceptedAt: i === 1 ? iso(1) : null,
    declinedAt: i === 2 ? iso(1) : null,
    lastSentAt: iso(1),
    deliveryStatus: i === 0 ? 'SENT' : 'DELIVERED',
    lastError: null,
  }));
  const templates = [
    'submission.confirmed',
    'decision.notified',
    'registration.confirmed',
    'reviewer.invitation',
    'reviewer.reminder_digest',
    'registration.window_open',
  ].map((key, i) => ({
    ...base,
    id: id(1600 + i),
    key,
    version: 1,
    locale: 'en',
    subject: `[ICACM 2026 Demo] ${key.replaceAll('.', ' ')}`,
    bodyHtml:
      '<h2>ICACM 2026 — Demonstration email</h2><p>Hello {{name}},</p><p>This is dummy content for testing the organizer workspace. No email is delivered.</p><p>Kind regards,<br>The Demo Organizing Committee</p>',
    bodyText: 'This is a dummy message for local testing only.',
    variables: ['name', 'conferenceName', 'paperTitle'],
    isActive: true,
  }));
  const logs = templates.map((t, i) => ({
    ...base,
    id: id(1700 + i),
    templateKey: t.key,
    templateVersion: 1,
    toEmail: authors[i].email,
    subject: t.subject,
    status: i === 4 ? 'FAILED' : i === 5 ? 'QUEUED' : 'SENT',
    providerMessageId: `demo_message_${i}`,
    error: i === 4 ? 'Simulated temporary delivery failure' : null,
    idempotencyKey: `demo-notification-${i}`,
    queuedAt: iso(1),
    sentAt: i < 4 ? iso(1) : null,
    relatedEntity: 'Paper',
    relatedEntityId: papers[i].id,
  }));
  const inbox = [
    {
      id: id(1800),
      kind: 'CONFERENCE',
      version: 1,
      paperId: null,
      roundId: null,
      title: 'Registration window is open',
      subject: 'Accepted papers can now register',
      eventType: 'registration.window_open',
      updatedAt: iso(2),
      unread: true,
      href: `/dashboard/conferences/${conferenceId}/registrations/all`,
    },
    {
      id: id(1801),
      kind: 'REVIEW',
      version: 1,
      paperId: papers[4].id,
      roundId: rounds[4].id,
      title: 'A review is ready for your attention',
      subject: papers[4].title,
      updatedAt: iso(1),
      unread: true,
      href: `/dashboard/conferences/${conferenceId}/reviews/rounds`,
    },
    {
      id: id(1802),
      kind: 'CONFERENCE',
      version: 1,
      paperId: null,
      roundId: null,
      title: 'Student proof submitted',
      subject: 'Maya Chen uploaded an enrollment certificate',
      updatedAt: iso(1),
      unread: false,
      href: `/dashboard/conferences/${conferenceId}/registrations/verifications`,
    },
  ];
  inbox.push({
    id: id(1803),
    kind: 'REBUTTAL',
    version: 1,
    paperId: papers[5].id,
    roundId: rounds[5].id,
    title: 'Author response received',
    subject: papers[5].title,
    updatedAt: iso(1),
    unread: false,
    href: `/dashboard/conferences/${conferenceId}/submissions/${papers[5].id}?section=rebuttal`,
  });
  const campaigns = [
    'TPC invitation — November cohort',
    'Final call for accepted authors',
    'Sustainable computing community',
  ].map((name, i) => ({
    ...base,
    id: id(1900 + i),
    name,
    type: ['TPC_INVITATION', 'PAPER_SUBMISSION_INVITATION', 'GENERAL_OUTREACH'][i],
    status: ['READY', 'SENT', 'DRAFT'][i],
    templateId: id(1950 + i),
    templateKey: `demo.outreach.${i}`,
    templateName: [
      'Technical program committee invitation',
      'Call for papers',
      'Research community outreach',
    ][i],
    subject: `ICACM 2026 Demo — ${name}`,
    bodyHtml:
      '<h2>Invitation to ICACM 2026</h2><p>Dear {{name}}, your work on {{topic}} is relevant to our community.</p><p>This is a local demonstration. No emails are sent.</p>',
    fromName: 'ICACM Demo Committee',
    fromEmail: 'committee@example.test',
    replyToEmail: 'organizer@example.test',
    recipientCount: 4,
    sentCount: i === 1 ? 4 : 0,
    failedCount: 0,
    skippedCount: 0,
    confirmedAt: i === 1 ? iso(1) : null,
    sentAt: i === 1 ? iso(1) : null,
  }));
  const recipients = campaigns.flatMap((campaign, i) =>
    reviewers
      .slice(0, 4)
      .map((r, j) => ({
        id: id(2000 + i * 10 + j),
        campaignId: campaign.id,
        name: r.name,
        email: r.email,
        topic: ['responsible AI', 'distributed systems', 'privacy', 'sustainable computing'][j],
        paper: titles[j],
        status: i === 1 ? 'SENT' : 'PENDING',
        providerMessageId: i === 1 ? `demo_${j}` : null,
        error: null,
        sentAt: i === 1 ? iso(1) : null,
        deliveredAt: null,
        createdAt,
      })),
  );
  const outreachTemplates = campaigns.map((c) => ({
    id: c.templateId,
    key: c.templateKey,
    name: c.templateName,
    version: 1,
    subject: c.subject,
    bodyHtml: c.bodyHtml,
    bodyText: 'Dear {{name}}, this is a demo invitation about {{topic}} and {{paper}}.',
    variables: ['name', 'topic', 'paper'],
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  }));
  const integrations = [
    {
      id: id(2100),
      conferenceId,
      name: 'Demo reporting assistant',
      purpose: 'Read-only local analytics and committee reporting.',
      status: 'ACTIVE',
      scopes: ['papers:read', 'analytics:read', 'assignments:read'],
      authorizedByUserId: organizerId,
      authorizerName: user.name,
      version: 1,
      createdAt,
      updatedAt: createdAt,
      keys: [
        {
          id: id(2101),
          label: 'Local demo key (nonfunctional)',
          scopes: ['papers:read', 'analytics:read'],
          createdAt,
          expiresAt: iso(30),
          revokedAt: null,
          lastUsedAt: iso(1),
        },
      ],
    },
  ];
  const audits = [
    'conference.settings_updated',
    'decision.made',
    'registration.opened',
    'payment.captured',
    'student_verification.approved',
    'assignment.created',
    'review.submitted',
    'notification.resent',
  ].map((action, i) => ({
    ...base,
    id: id(2200 + i),
    actorUserId: organizerId,
    action,
    entity: [
      'Conference',
      'Decision',
      'Registration',
      'Payment',
      'StudentVerification',
      'ReviewerAssignment',
      'Review',
      'NotificationLog',
    ][i],
    entityId: id(900 + i),
    diff: { demo: true },
    createdAt: iso((i % 2) + 1),
  }));
  return {
    user,
    conference,
    organization: {
      id: orgId,
      name: 'Open Research Society · Demo',
      slug: 'demo-research-society',
    },
    tracks,
    reviewers,
    authors,
    members,
    papers,
    rounds,
    assignments,
    reviews,
    decisions,
    registrations,
    payments,
    verifications,
    bids,
    conflicts,
    invitations,
    templates,
    logs,
    inbox,
    campaigns,
    recipients,
    outreachTemplates,
    integrations,
    audits,
  };
}

export function coordination(state) {
  const data = state.papers
    .filter((p) => p.status !== 'WITHDRAWN')
    .map((p) => {
      const round = state.rounds.find((r) => r.id === p.latestCycleId);
      const assignments = state.assignments.filter((a) => a.paperId === p.id);
      const submitted = assignments.filter((a) => a.reviewProgress === 'SUBMITTED').length;
      return {
        paperId: p.id,
        paperTitle: p.title,
        paperSubmittedAt: p.submittedAt,
        submissionNumber: p.submissionNumber,
        paperStatus: p.status,
        paperVersion: p.version,
        cycleId: round.id,
        roundNumber: round.roundNumber,
        cycleVersion: round.version,
        reviewStage: round.reviewStage,
        assignmentCount: assignments.length,
        submittedReviewCount: submitted,
        reviewsReleasedAt: round.reviewsReleasedAt,
        warning: assignments.length < 2 ? 'Needs another reviewer' : null,
        isCurrentCycle: true,
        trackId: p.trackId,
        trackName: state.tracks.find((t) => t.id === p.trackId).name,
        reviewDueAt: round.reviewDueAt,
        assignments,
        needsReviewers: assignments.length < 2,
        overdueReviewCount: assignments.filter((a) => a.overdue).length,
        readyForDecision: submitted >= 2 && p.status === 'UNDER_REVIEW',
        canIntervene: p.status === 'UNDER_REVIEW',
        canReleaseReviews: submitted >= 2 && !round.reviewsReleasedAt,
      };
    });
  return {
    observedAt: new Date().toISOString(),
    minimumReviews: 2,
    data,
    summary: {
      needsReviewers: data.filter((p) => p.needsReviewers).length,
      overdueReviews: data.reduce((n, p) => n + p.overdueReviewCount, 0),
      overduePapers: data.filter((p) => p.overdueReviewCount).length,
      readyForDecision: data.filter((p) => p.readyForDecision).length,
      pendingInvitations: state.invitations.filter((i) => i.status === 'PENDING').length,
    },
    deadlines: {
      reviewDueAt: state.conference.reviewDueAt,
      rebuttalDueAt: state.conference.rebuttalDueAt,
    },
  };
}

export function reviewerOverview(state, query) {
  const data = aggregateReviewerWorkload(state.reviewers, state.assignments);
  return {
    observedAt: new Date().toISOString(),
    conferenceName: state.conference.name,
    scope: { history: query.get('history') ?? 'CURRENT' },
    complete: true,
    data,
    roster: state.reviewers,
    tracks: state.tracks,
    cycles: [1, 2],
    summary: {
      overdue: data.reduce((n, r) => n + r.overdue, 0),
      dueSoon: data.reduce((n, r) => n + r.dueSoon, 0),
      allSubmitted: data.filter((r) => r.allSubmitted).length,
      unassigned: data.filter((r) => !r.assigned).length,
    },
  };
}

export function analytics(state) {
  const tally = (rows, field) =>
    [...new Set(rows.map((r) => r[field]))].map((value) => ({
      [field]: value,
      count: rows.filter((r) => r[field] === value).length,
    }));
  const active = state.papers.filter((p) => !['DRAFT', 'WITHDRAWN'].includes(p.status));
  const paid = state.registrations.filter((r) => r.status === 'PAID').length;
  const usd = state.payments.filter((p) => p.currency === 'USD');
  const revenueMinor = usd.reduce((n, p) => n + p.amountMinor, 0);
  return {
    conferenceId,
    computedAt: new Date().toISOString(),
    currency: 'USD',
    submissions: {
      total: active.length,
      excluded: { draft: 0, withdrawn: 1 },
      byStatus: tally(active, 'status'),
      byDay: state.papers.map((p) => ({ date: p.submittedAt.slice(0, 10), count: 1 })),
    },
    reviews: {
      assigned: state.assignments.length,
      completed: state.assignments.filter((a) => a.status === 'COMPLETED').length,
      submitted: state.reviews.filter((r) => r.submittedAt).length,
      draft: state.reviews.filter((r) => !r.submittedAt).length,
      notStarted: state.assignments.filter((a) => a.reviewProgress === 'NOT_STARTED').length,
      closedIncomplete: 0,
      inconsistent: 0,
      overdue: state.assignments.filter((a) => a.overdue).length,
      underCoveredPapers: 1,
      reviewerLoad: state.reviewers.map((r) => ({
        id: r.userId,
        name: r.name,
        count: state.assignments.filter((a) => a.reviewerUserId === r.userId).length,
      })),
    },
    decisions: {
      total: state.decisions.length,
      acceptRate:
        state.decisions.filter((d) => d.outcome === 'ACCEPT').length / state.decisions.length,
      byOutcome: tally(state.decisions, 'outcome'),
    },
    registrations: {
      total: state.registrations.length,
      paid,
      unpaid: state.registrations.length - paid,
      atRisk: 1,
      overdue: 0,
      byStatus: tally(state.registrations, 'status'),
    },
    revenueMinor,
    revenueByTiming: [{ name: 'EARLY', amountMinor: revenueMinor }],
    revenueByAudience: ['REGULAR', 'STUDENT'].map((name) => ({
      name,
      amountMinor: usd
        .filter(
          (p) => state.registrations.find((r) => r.id === p.registrationId)?.audience === name,
        )
        .reduce((n, p) => n + p.amountMinor, 0),
    })),
    excludedCurrencyPayments: state.payments.length - usd.length,
    unpaidAccepted: 2,
    authors: state.authors
      .map((a) => ({
        name: a.name,
        count: state.papers.filter((p) => p.submittedById === a.userId).length,
      }))
      .filter((a) => a.count),
    institutions: institutions.map((name) => ({
      name,
      count: state.papers.filter((p) => p.authorships.some((a) => a.affiliation === name)).length,
    })),
  };
}
