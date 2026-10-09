import type { Prisma } from '@prisma/client';
import { effectiveReviewDeadline, type ReviewerDigestSnapshot } from '@openconferences/schemas';

export function prismaQueueAdapter(tx: Prisma.TransactionClient) {
  return {
    executeSql: async (sql: string, values: unknown[]) => ({
      rows: await tx.$queryRawUnsafe<unknown[]>(sql, ...values),
    }),
  };
}

/** Caller holds cycle row locks; reread submission/closure/version under those locks. */
export async function validateDigestTargets(
  tx: Prisma.TransactionClient,
  conferenceId: string,
  reviewerUserId: string,
  targets: Array<{ id: string; version: number }>,
) {
  const member = await tx.membership.findFirst({
    where: {
      conferenceId,
      scope: 'CONFERENCE',
      userId: reviewerUserId,
      roles: { some: { role: 'REVIEWER' } },
    },
    select: { user: { select: { name: true, email: true } } },
  });
  if (!member) throw new Error('Reviewer no longer has a reviewer role in this conference');
  const rows = await tx.reviewerAssignment.findMany({
    where: { conferenceId, reviewerUserId, id: { in: targets.map((t) => t.id) } },
    include: {
      review: { select: { submittedAt: true } },
      conference: { select: { reviewDueAt: true, name: true } },
      round: {
        select: {
          reviewDueAt: true,
          roundNumber: true,
          reviewsReleasedAt: true,
          decisions: { select: { id: true }, take: 1 },
        },
      },
      paper: {
        select: {
          title: true,
          submissionNumber: true,
          status: true,
          reviewRounds: { select: { id: true }, orderBy: { roundNumber: 'desc' }, take: 1 },
        },
      },
    },
  });
  if (rows.length !== targets.length)
    throw new Error('An assignment is missing or belongs to another reviewer');
  const versions = new Map(targets.map((t) => [t.id, t.version]));
  const now = new Date();
  const items = rows
    .map((a) => {
      if (
        versions.get(a.id) !== a.version ||
        !['ASSIGNED', 'ACCEPTED'].includes(a.status) ||
        a.review?.submittedAt ||
        !['SUBMITTED', 'UNDER_REVIEW'].includes(a.paper.status) ||
        a.round.reviewsReleasedAt ||
        a.round.decisions.length ||
        a.paper.reviewRounds[0]?.id !== a.roundId
      )
        throw new Error('Assignments changed or are no longer open. Refresh and preview again.');
      const dueAt = effectiveReviewDeadline(a, a.round.reviewDueAt, a.conference.reviewDueAt);
      return {
        id: a.id,
        version: a.version,
        paperId: a.paperId,
        roundId: a.roundId,
        paperTitle: a.paper.title,
        submissionNumber: a.paper.submissionNumber,
        roundNumber: a.round.roundNumber,
        dueAt: dueAt.toISOString(),
        overdue: dueAt < now,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  return { member: member.user, items, conferenceName: rows[0]!.conference.name };
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function renderReviewerDigest(
  template: { subject: string; bodyHtml: string; bodyText: string | null },
  data: Pick<ReviewerDigestSnapshot, 'conferenceName' | 'reviewerName' | 'reviewUrl' | 'items'>,
) {
  const url = new URL(data.reviewUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid review link');
  const date = (s: string) =>
    `${new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s))} UTC`;
  const lines = data.items.map(
    (i) =>
      `${i.submissionNumber ?? 'Unnumbered'} · ${i.paperTitle} · Cycle ${i.roundNumber} · Due ${date(i.dueAt)}${i.overdue ? ' · Overdue' : ''}`,
  );
  const htmlItems = lines
    .map((s) => `<span style="display:block;margin-bottom:12px">${escape(s)}</span>`)
    .join('');
  const textItems = lines.map((s) => `- ${s}`).join('\n');
  const vars: Record<string, string> = {
    conferenceName: data.conferenceName,
    reviewerName: data.reviewerName,
    reviewUrl: data.reviewUrl,
  };
  const scalar = (s: string, html: boolean, includeItems = false) =>
    s.replace(/\{\{(\w+)\}\}/g, (_m, k: string) =>
      k === 'reviewItems'
        ? includeItems
          ? html
            ? htmlItems
            : textItems
          : ''
        : html
          ? escape(vars[k] ?? '')
          : (vars[k] ?? ''),
    );
  // Resolve reserved blocks in the template in a single pass; user strings are never reparsed.
  const html = scalar(template.bodyHtml, true, true);
  const sourceText = template.bodyText ?? '{{conferenceName}}\n{{reviewItems}}\n{{reviewUrl}}';
  const text = scalar(sourceText, false, true);
  return {
    subject: scalar(template.subject, false).replace(/[\r\n]/g, ' '),
    html: template.bodyHtml.includes('{{reviewItems}}')
      ? html
      : html.replace(/<\/body>/i, `${htmlItems}</body>`) +
        (html.toLowerCase().includes('</body>') ? '' : htmlItems),
    text: sourceText.includes('{{reviewItems}}') ? text : `${text}\n\n${textItems}`,
  };
}
