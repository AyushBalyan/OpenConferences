import { initContract } from '@ts-rest/core';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  organizationSchema,
  createConferenceSchema,
  updateConferenceSchema,
  updateConferenceSettingsSchema,
  conferenceSchema,
  conferenceListSchema,
  createTrackSchema,
  updateTrackSchema,
  trackSchema,
  trackListSchema,
  grantRoleSchema,
  revokeRoleSchema,
  memberListSchema,
  transitionStatusSchema,
  auditLogListSchema,
  auditLogListQuerySchema,
  organizationListSchema,
  problemEnvelopeSchema,
  cursorPaginationQuerySchema,
  authorJoinTokenSchema,
  joinAsAuthorResponseSchema,
  authorJoinLinkSchema,
} from '@openconferences/schemas';
import { z } from 'zod';

const c = initContract();

const conferenceIdParams = z.object({
  id: z.string().uuid(),
});

const trackIdParams = z.object({
  id: z.string().uuid(),
  trackId: z.string().uuid(),
});

const listQuerySchema = cursorPaginationQuerySchema.extend({
  organizationId: z.string().uuid().optional(),
});

export const organizationsContract = c.router({
  list: {
    method: 'GET',
    path: '/organizations',
    query: listQuerySchema,
    responses: {
      200: organizationListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
    },
    summary: 'List organizations the user belongs to',
  },
  create: {
    method: 'POST',
    path: '/organizations',
    body: createOrganizationSchema,
    responses: {
      201: organizationSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Create organization (PLATFORM_ADMIN only)',
  },
  get: {
    method: 'GET',
    path: '/organizations/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      200: organizationSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Get organization by id',
  },
  update: {
    method: 'PATCH',
    path: '/organizations/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    body: updateOrganizationSchema,
    responses: {
      200: organizationSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Update organization',
  },
});

export type OrganizationsContract = typeof organizationsContract;

export const conferencesContract = c.router({
  list: {
    method: 'GET',
    path: '/conferences',
    query: listQuerySchema,
    responses: {
      200: conferenceListSchema,
      401: problemEnvelopeSchema,
    },
    summary: 'List conferences for current user',
  },
  create: {
    method: 'POST',
    path: '/conferences',
    body: createConferenceSchema,
    responses: {
      201: conferenceSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Create conference in organization',
  },
  get: {
    method: 'GET',
    path: '/conferences/:id',
    pathParams: conferenceIdParams,
    responses: {
      200: conferenceSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Get conference by id',
  },
  update: {
    method: 'PATCH',
    path: '/conferences/:id',
    pathParams: conferenceIdParams,
    body: updateConferenceSchema,
    responses: {
      200: conferenceSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Update conference metadata',
  },
  updateSettings: {
    method: 'PATCH',
    path: '/conferences/:id/settings',
    pathParams: conferenceIdParams,
    body: updateConferenceSettingsSchema,
    responses: {
      200: conferenceSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Update conference settings (phases, blinding, fees, review config)',
  },
  transitionStatus: {
    method: 'PATCH',
    path: '/conferences/:id/status',
    pathParams: conferenceIdParams,
    body: transitionStatusSchema,
    responses: {
      200: conferenceSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Transition conference lifecycle status',
  },
  listTracks: {
    method: 'GET',
    path: '/conferences/:id/tracks',
    pathParams: conferenceIdParams,
    query: cursorPaginationQuerySchema,
    responses: {
      200: trackListSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List tracks for conference',
  },
  createTrack: {
    method: 'POST',
    path: '/conferences/:id/tracks',
    pathParams: conferenceIdParams,
    body: createTrackSchema,
    responses: {
      201: trackSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Create track',
  },
  updateTrack: {
    method: 'PATCH',
    path: '/conferences/:id/tracks/:trackId',
    pathParams: trackIdParams,
    body: updateTrackSchema,
    responses: {
      200: trackSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Update track',
  },
  deleteTrack: {
    method: 'DELETE',
    path: '/conferences/:id/tracks/:trackId',
    pathParams: trackIdParams,
    body: c.noBody(),
    responses: {
      204: c.noBody(),
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Soft-delete track',
  },
  listMembers: {
    method: 'GET',
    path: '/conferences/:id/members',
    pathParams: conferenceIdParams,
    query: cursorPaginationQuerySchema,
    responses: {
      200: memberListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List conference members and roles',
  },
  grantRole: {
    method: 'POST',
    path: '/conferences/:id/members/grant',
    pathParams: conferenceIdParams,
    body: grantRoleSchema,
    responses: {
      201: memberListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Grant role to user in conference/org scope',
  },
  revokeRole: {
    method: 'POST',
    path: '/conferences/:id/members/revoke',
    pathParams: conferenceIdParams,
    body: revokeRoleSchema,
    responses: {
      200: memberListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Revoke role from user',
  },
  listAuditLogs: {
    method: 'GET',
    path: '/conferences/:id/audit-logs',
    pathParams: conferenceIdParams,
    query: auditLogListQuerySchema,
    responses: {
      200: auditLogListSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List audit log entries for conference (stub)',
  },
  joinAsAuthor: {
    method: 'POST',
    path: '/conferences/join-as-author',
    body: authorJoinTokenSchema,
    responses: {
      200: joinAsAuthorResponseSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Join a conference as author via public submit link token',
  },
  getAuthorJoinLink: {
    method: 'GET',
    path: '/conferences/:id/author-join-link',
    pathParams: conferenceIdParams,
    responses: {
      200: authorJoinLinkSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Get the public author submit link for a conference',
  },
  rotateAuthorJoinLink: {
    method: 'POST',
    path: '/conferences/:id/author-join-link/rotate',
    pathParams: conferenceIdParams,
    body: c.noBody(),
    responses: {
      200: authorJoinLinkSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Rotate the public author submit link token',
  },
});

export type ConferencesContract = typeof conferencesContract;
