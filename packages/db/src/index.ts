import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbRoleAsserted?: boolean;
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
};

type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

async function applyTenantGucs(tx: TransactionClient, ctx: TenantContext): Promise<void> {
  // Transaction-local context only — no app.bypass_rls escape hatch.
  // Policies bind membership plus optional/required route tenant IDs.
  const statements: Prisma.Sql[] = [
    ctx.userId
      ? Prisma.sql`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`
      : Prisma.sql`SELECT set_config('app.current_user_id', '', true)`,
    ctx.organizationId
      ? Prisma.sql`SELECT set_config('app.current_org_id', ${ctx.organizationId}, true)`
      : Prisma.sql`SELECT set_config('app.current_org_id', '', true)`,
    ctx.conferenceId
      ? Prisma.sql`SELECT set_config('app.current_conference_id', ${ctx.conferenceId}, true)`
      : Prisma.sql`SELECT set_config('app.current_conference_id', '', true)`,
  ];

  for (const statement of statements) {
    await tx.$executeRaw(statement);
  }
}

/**
 * Reject production/runtime connections that still use a BYPASSRLS or superuser role.
 * Migrations/seed may use the owner role intentionally (skip via SKIP_DB_ROLE_CHECK=true).
 */
export async function assertSafeDatabaseRole(client: PrismaClient = prisma): Promise<void> {
  if (process.env.SKIP_DB_ROLE_CHECK === 'true') {
    return;
  }
  if (process.env.NODE_ENV !== 'production' && process.env.ENFORCE_DB_ROLE_CHECK !== 'true') {
    return;
  }
  if (globalForPrisma.dbRoleAsserted) {
    return;
  }

  const rows = await client.$queryRaw<
    Array<{ current_user: string; rolsuper: boolean; rolbypassrls: boolean }>
  >`
    SELECT
      current_user,
      r.rolsuper,
      r.rolbypassrls
    FROM pg_roles r
    WHERE r.rolname = current_user
  `;

  const row = rows[0];
  if (!row) {
    throw new Error('Unable to resolve current database role');
  }
  if (row.rolsuper || row.rolbypassrls) {
    throw new Error(
      `Unsafe database role "${row.current_user}" (super=${row.rolsuper}, bypassrls=${row.rolbypassrls}). ` +
        'Use openconferences_api / openconferences_worker (NOBYPASSRLS) for API/worker runtime.',
    );
  }

  globalForPrisma.dbRoleAsserted = true;
}

/**
 * Run callback inside a transaction with tenant GUCs set (§18.4).
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
