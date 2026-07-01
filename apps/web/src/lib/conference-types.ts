export type Conference = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  status: string;
  blindingMode: string;
  version: number;
  myRoles: string[];
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

export type NotificationLogEntry = {
  id: string;
  templateKey: string;
  toEmail: string;
  subject: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'BOUNCED';
  providerMessageId: string | null;
  error: string | null;
  queuedAt: string;
  sentAt: string | null;
  createdAt: string;
};

export type NotificationTemplateEntry = {
  id: string;
  key: string;
  version: number;
  locale: string;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  variables: string[];
  isActive: boolean;
  updatedAt: string;
};
