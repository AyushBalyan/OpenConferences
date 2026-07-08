import { withTenantContext } from '@openconferences/db';

export function isPlaceholderDisplayName(name: string, email: string): boolean {
  const normalizedName = name.trim().toLowerCase();
  const localPart = email.split('@')[0]?.trim().toLowerCase() ?? '';
  return normalizedName.length > 0 && localPart.length > 0 && normalizedName === localPart;
}

export async function userHasCredentialPassword(userId: string): Promise<boolean> {
  const account = await withTenantContext({ bypass: true }, async (tx) =>
    tx.account.findFirst({
      where: {
        userId,
        providerId: 'credential',
        password: { not: null },
      },
      select: { id: true },
    }),
  );

  return account != null;
}

export function needsProfileSetup(input: {
  name: string;
  email: string;
  hasPassword: boolean;
}): boolean {
  return !input.hasPassword || isPlaceholderDisplayName(input.name, input.email);
}
