import { effectiveConferenceStatus } from '@openconferences/schemas';
import type { Conference, ConferenceStatus, Track } from '@openconferences/db';
import type {
  BlindingMode as SchemaBlindingMode,
  ConferenceDto,
  ConferenceStatus as SchemaConferenceStatus,
  RoleKind as SchemaRoleKind,
  BillingFeeSchedule,
} from '@openconferences/schemas';

type JsonValue = Record<string, unknown>;

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function parseReviewConfig(value: unknown): {
  scoreDimensions: string[];
  recommendationRequired: boolean;
  confidenceRequired?: boolean;
  minimumReviews: number;
} {
  const obj = (value ?? {}) as JsonValue;
  return {
    scoreDimensions: Array.isArray(obj.scoreDimensions)
      ? (obj.scoreDimensions as string[])
      : ['originality', 'clarity', 'significance'],
    recommendationRequired:
      typeof obj.recommendationRequired === 'boolean' ? obj.recommendationRequired : true,
    confidenceRequired:
      typeof obj.confidenceRequired === 'boolean' ? obj.confidenceRequired : undefined,
    minimumReviews:
      typeof obj.minimumReviews === 'number' && obj.minimumReviews > 0 ? obj.minimumReviews : 1,
  };
}

function parseFeeSchedule(value: unknown): BillingFeeSchedule {
  const obj = (value ?? {}) as JsonValue;
  const matrix = (obj.matrix ?? {}) as JsonValue;
  return {
    currency: typeof obj.currency === 'string' ? obj.currency : 'INR',
    ...(typeof obj.additionalPaperMinor === 'number'
      ? { additionalPaperMinor: obj.additionalPaperMinor }
      : {}),
    ...(typeof obj.domesticInrPerUsd === 'number'
      ? { domesticInrPerUsd: obj.domesticInrPerUsd }
      : {}),
    earlyBirdEndsAt: typeof obj.earlyBirdEndsAt === 'string' ? obj.earlyBirdEndsAt : null,
    registrationDeadlineAt:
      typeof obj.registrationDeadlineAt === 'string' ? obj.registrationDeadlineAt : null,
    matrix: {
      REGULAR: {
        EARLY: Number((matrix.REGULAR as JsonValue)?.EARLY ?? 0),
        REGULAR: Number((matrix.REGULAR as JsonValue)?.REGULAR ?? 0),
      },
      STUDENT: {
        EARLY: Number((matrix.STUDENT as JsonValue)?.EARLY ?? 0),
        REGULAR: Number((matrix.STUDENT as JsonValue)?.REGULAR ?? 0),
      },
    },
  };
}

export function mapConference(
  conference: Conference,
  myRoles: SchemaRoleKind[] = [],
): ConferenceDto {
  return {
    id: conference.id,
    organizationId: conference.organizationId,
    slug: conference.slug,
    name: conference.name,
    status: deriveStatusFromWindows(conference) as SchemaConferenceStatus,
    invitationLifetimeDays: conference.invitationLifetimeDays,
    blindingMode: conference.blindingMode as SchemaBlindingMode,
    cfpOpensAt: toIso(conference.cfpOpensAt),
    cfpClosesAt: toIso(conference.cfpClosesAt),
    biddingOpensAt: toIso(conference.biddingOpensAt),
    biddingClosesAt: toIso(conference.biddingClosesAt),
    reviewDueAt: toIso(conference.reviewDueAt),
    rebuttalDueAt: toIso(conference.rebuttalDueAt),
    decisionDueAt: toIso(conference.decisionDueAt),
    cameraReadyDueAt: toIso(conference.cameraReadyDueAt),
    registrationDueAt: toIso(conference.registrationDueAt),
    reviewConfig: parseReviewConfig(conference.reviewConfig),
    feeSchedule: parseFeeSchedule(conference.feeSchedule),
    version: conference.version,
    myRoles,
    createdAt: conference.createdAt.toISOString(),
    updatedAt: conference.updatedAt.toISOString(),
  };
}

export function mapTrack(track: Track) {
  return {
    id: track.id,
    conferenceId: track.conferenceId,
    organizationId: track.organizationId,
    slug: track.slug,
    name: track.name,
    description: track.description,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  };
}

export const VALID_STATUS_TRANSITIONS: Record<ConferenceStatus, ConferenceStatus[]> = {
  DRAFT: ['CFP_OPEN', 'CFP_CLOSED', 'ARCHIVED'],
  CFP_OPEN: ['CFP_CLOSED', 'REVIEWING', 'DRAFT', 'ARCHIVED'],
  CFP_CLOSED: ['CFP_OPEN', 'REVIEWING', 'ARCHIVED'],
  REVIEWING: ['DECISIONS', 'CFP_OPEN', 'ARCHIVED'],
  DECISIONS: ['FINALIZATION', 'REVIEWING', 'ARCHIVED'],
  FINALIZATION: ['COMPLETED', 'DECISIONS', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function deriveStatusFromWindows(conference: Conference): ConferenceStatus {
  return effectiveConferenceStatus(conference);
}

export function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}
