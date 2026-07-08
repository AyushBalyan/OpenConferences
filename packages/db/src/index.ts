import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type TenantContext = {
  userId?: string;
  organizationId?: string;
  conferenceId?: string;
  bypass?: boolean;
};

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

async function applyTenantGucs(tx: TransactionClient, ctx: TenantContext): Promise<void> {
  const statements: Prisma.Sql[] = [];

  if (ctx.bypass) {
    statements.push(Prisma.sql`SELECT set_config('app.bypass_rls', 'on', true)`);
  } else {
    statements.push(Prisma.sql`SELECT set_config('app.bypass_rls', 'off', true)`);
  }

  if (ctx.userId) {
    statements.push(Prisma.sql`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`);
  } else {
    statements.push(Prisma.sql`SELECT set_config('app.current_user_id', '', true)`);
  }

  if (ctx.organizationId) {
    statements.push(
      Prisma.sql`SELECT set_config('app.current_org_id', ${ctx.organizationId}, true)`,
    );
  } else {
    statements.push(Prisma.sql`SELECT set_config('app.current_org_id', '', true)`);
  }

  if (ctx.conferenceId) {
    statements.push(
      Prisma.sql`SELECT set_config('app.current_conference_id', ${ctx.conferenceId}, true)`,
    );
  } else {
    statements.push(Prisma.sql`SELECT set_config('app.current_conference_id', '', true)`);
  }

  for (const statement of statements) {
    await tx.$executeRaw(statement);
  }
}

/**
 * Run callback inside a transaction with RLS GUCs set (§18.4).
 * All tenant-scoped reads/writes should use this helper.
 */
export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (tx: TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await applyTenantGucs(tx, ctx);
    return fn(tx);
  });
}

export { PrismaClient, Prisma };
export { generateId } from './id.js';
export { syncPlatformNotificationTemplates } from './sync-notification-templates.js';
export { PLATFORM_NOTIFICATION_TEMPLATES } from './notification-templates.js';
export type { PlatformNotificationTemplate } from './notification-templates.js';
export { applyScanResult } from './scan.js';
export type { ApplyScanResultInput } from './scan.js';
export type {
  RoleKind,
  MembershipScope,
  ConferenceStatus,
  BlindingMode,
  PaperStatus,
  VersionKind,
  FileScanStatus,
  BidValue,
  CoiType,
  CoiSource,
  RoundStatus,
  ReviewVisibility,
  InvitationStatus,
  AssignmentStatus,
  Recommendation,
  Organization,
  Conference,
  Track,
  Membership,
  Paper,
  Authorship,
  PaperVersion,
  FileAsset,
  ReviewRound,
  ReviewerInvitation,
  Bid,
  ConflictOfInterest,
  ReviewerAssignment,
  Review,
  Rebuttal,
  Decision,
  DecisionOutcome,
  FeeAudience,
  FeeTiming,
  PaymentStatus,
  PaymentKind,
  RegistrationStatus,
  VerificationStatus,
  Registration,
  Payment,
  Invoice,
  StudentVerification,
  InvoiceCounter,
  NotificationStatus,
  NotificationTemplate,
  NotificationLog,
  EmailSuppression,
} from '@prisma/client';
