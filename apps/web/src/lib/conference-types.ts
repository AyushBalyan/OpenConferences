export type Conference = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  status: string;
  blindingMode: string;
  version: number;
};

export type Track = {
  id: string;
  conferenceId: string;
  slug: string;
  name: string;
  description: string | null;
};

export type Member = {
  userId: string;
  email: string;
  name: string;
  scope: 'ORGANIZATION' | 'CONFERENCE';
  roles: string[];
  membershipId: string;
};

export type Organization = {
  id: string;
  slug: string;
  name: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  createdAt: string;
};
