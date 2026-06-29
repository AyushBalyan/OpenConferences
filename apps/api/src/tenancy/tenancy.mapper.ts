import type { Conference, ConferenceStatus, Track } from '@openconferences/db';
import type {
  ConferenceStatus as SchemaConferenceStatus,
  BlindingMode as SchemaBlindingMode,
} from '@openconferences/schemas';

type JsonValue = Record<string, unknown>;

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function parseReviewConfig(value: unknown): {
  scoreDimensions: string[];
  recommendationRequired: boolean;
  confidenceRequired?: boolean;
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
  };
}

function parseFeeSchedule(value: unknown): {
  currency: string;
  matrix: Record<'REGULAR' | 'STUDENT', Record<'EARLY' | 'REGULAR', number>>;
} {
  const obj = (value ?? {}) as JsonValue;
  const matrix = (obj.matrix ?? {}) as JsonValue;
  return {
    currency: typeof obj.currency === 'string' ? obj.currency : 'INR',
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

export function mapConference(conference: Conference) {
  return {
    id: conference.id,
    organizationId: conference.organizationId,
    slug: conference.slug,
    name: conference.name,
    status: conference.status as SchemaConferenceStatus,
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
  DRAFT: ['CFP_OPEN', 'ARCHIVED'],
  CFP_OPEN: ['REVIEWING', 'DRAFT', 'ARCHIVED'],
  REVIEWING: ['DECISIONS', 'CFP_OPEN', 'ARCHIVED'],
  DECISIONS: ['FINALIZATION', 'REVIEWING', 'ARCHIVED'],
  FINALIZATION: ['COMPLETED', 'DECISIONS', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function deriveStatusFromWindows(conference: Conference): ConferenceStatus {
  const now = new Date();

  if (conference.status === 'ARCHIVED' || conference.status === 'COMPLETED') {
    return conference.status;
  }

  // Before the CFP window opens, status is always draft (§6 — window-driven lifecycle).
  if (!conference.cfpOpensAt || now < conference.cfpOpensAt) {
    return 'DRAFT';
  }

  if (!conference.cfpClosesAt || now < conference.cfpClosesAt) {
    return 'CFP_OPEN';
  }

  if (conference.cfpClosesAt && now >= conference.cfpClosesAt) {
    if (conference.reviewDueAt && now < conference.reviewDueAt) {
      return 'REVIEWING';
    }
    if (conference.decisionDueAt && now < conference.decisionDueAt) {
      return 'DECISIONS';
    }
  }

  return conference.status;
}

export function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}
