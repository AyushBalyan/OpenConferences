import { initClient } from '@ts-rest/core';
import { apiContract } from '@openconferences/contracts';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const apiClient = initClient(apiContract, {
  baseUrl,
  baseHeaders: {},
  credentials: 'include',
});

export async function fetchHealthz() {
  const result = await apiClient.health.healthz();
  if (result.status === 200) {
    return result.body;
  }
  throw new Error(`Health check failed with status ${result.status}`);
}

export async function fetchMe() {
  const result = await apiClient.auth.me();
  if (result.status === 200) {
    return result.body;
  }
  return null;
}

export async function fetchOrganizations() {
  const result = await apiClient.organizations.list({ query: {} });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load organizations');
}

export async function fetchConferences(organizationId?: string) {
  const result = await apiClient.conferences.list({
    query: organizationId ? { organizationId } : {},
  });
  if (result.status === 200) return result.body;
  throw new Error('Failed to load conferences');
}

export async function fetchConference(id: string) {
  const result = await apiClient.conferences.get({ params: { id } });
  if (result.status === 200) return result.body;
  if (result.status === 404) throw new Error('Conference not found');
  throw new Error('Failed to load conference');
}

export async function createConference(body: {
  organizationId: string;
  slug: string;
  name: string;
  blindingMode?: 'SINGLE' | 'DOUBLE' | 'OPEN';
}) {
  const result = await apiClient.conferences.create({ body });
  if (result.status === 201) return result.body;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Forbidden');
  if (result.status === 409) throw new Error(result.body.detail ?? 'Conflict');
  throw new Error('Failed to create conference');
}

export async function updateConferenceSettings(id: string, body: Record<string, unknown>) {
  const result = await apiClient.conferences.updateSettings({ params: { id }, body });
  if (result.status === 200) return result.body;
  throw new Error('Failed to update settings');
}

export async function fetchTracks(conferenceId: string) {
  const result = await apiClient.conferences.listTracks({ params: { id: conferenceId } });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load tracks');
}

export async function createTrack(
  conferenceId: string,
  body: { slug: string; name: string; description?: string },
) {
  const result = await apiClient.conferences.createTrack({
    params: { id: conferenceId },
    body,
  });
  if (result.status === 201) return result.body;
  throw new Error('Failed to create track');
}

export async function fetchMembers(conferenceId: string) {
  const result = await apiClient.conferences.listMembers({ params: { id: conferenceId } });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load members');
}

export async function grantRole(
  conferenceId: string,
  body: {
    userId: string;
    role: 'AUTHOR' | 'REVIEWER' | 'CHAIR' | 'ORGANIZER' | 'ORG_ADMIN';
    scope: 'CONFERENCE' | 'ORGANIZATION';
  },
) {
  const result = await apiClient.conferences.grantRole({
    params: { id: conferenceId },
    body,
  });
  if (result.status === 201) return result.body.data;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Forbidden');
  throw new Error('Failed to grant role');
}

export async function revokeRole(
  conferenceId: string,
  body: {
    userId: string;
    role: 'AUTHOR' | 'REVIEWER' | 'CHAIR' | 'ORGANIZER' | 'ORG_ADMIN';
    scope: 'CONFERENCE' | 'ORGANIZATION';
  },
) {
  const result = await apiClient.conferences.revokeRole({
    params: { id: conferenceId },
    body,
  });
  if (result.status === 200) return result.body.data;
  if (result.status === 403) throw new Error(result.body.detail ?? 'Forbidden');
  if (result.status === 404) throw new Error(result.body.detail ?? 'Not found');
  throw new Error('Failed to revoke role');
}

export async function fetchAuditLogs(conferenceId: string) {
  const result = await apiClient.conferences.listAuditLogs({
    params: { id: conferenceId },
    query: { limit: 50 },
  });
  if (result.status === 200) return result.body.data;
  throw new Error('Failed to load audit logs');
}

export async function transitionConferenceStatus(
  id: string,
  status:
    'DRAFT' | 'CFP_OPEN' | 'REVIEWING' | 'DECISIONS' | 'FINALIZATION' | 'COMPLETED' | 'ARCHIVED',
) {
  const result = await apiClient.conferences.transitionStatus({
    params: { id },
    body: { status },
  });
  if (result.status === 200) return result.body;
  if (result.status === 409) throw new Error(result.body.detail ?? 'Invalid transition');
  throw new Error('Failed to transition status');
}
