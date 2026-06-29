export type AuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  image?: string | null;
  twoFactorEnabled?: boolean | null;
  createdAt: Date;
};

export type AuthSession = {
  user: AuthUser;
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
};
