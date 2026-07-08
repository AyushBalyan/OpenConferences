import { initContract } from '@ts-rest/core';
import {
  createPaperSchema,
  updatePaperSchema,
  paperSchema,
  paperListSchema,
  paperListQuerySchema,
  authorshipInputSchema,
  authorshipSchema,
  reorderAuthorshipsSchema,
  initiateVersionSchema,
  initiateVersionResponseSchema,
  completeVersionSchema,
  paperVersionSchema,
  presignedDownloadSchema,
  submitPaperResponseSchema,
  problemEnvelopeSchema,
} from '@openconferences/schemas';
import { z } from 'zod';

const c = initContract();

const conferencePaperParams = z.object({
  conferenceId: z.string().uuid(),
});

const paperParams = z.object({
  conferenceId: z.string().uuid(),
  paperId: z.string().uuid(),
});

const authorshipParams = z.object({
  conferenceId: z.string().uuid(),
  paperId: z.string().uuid(),
  authorshipId: z.string().uuid(),
});

const versionParams = z.object({
  conferenceId: z.string().uuid(),
  paperId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export const submissionContract = c.router({
  listPapers: {
    method: 'GET',
    path: '/conferences/:conferenceId/papers',
    pathParams: conferencePaperParams,
    query: paperListQuerySchema,
    responses: {
      200: paperListSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'List papers for a conference',
  },
  createPaper: {
    method: 'POST',
    path: '/conferences/:conferenceId/papers',
    pathParams: conferencePaperParams,
    body: createPaperSchema,
    responses: {
      201: paperSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Create a draft paper',
  },
  getPaper: {
    method: 'GET',
    path: '/conferences/:conferenceId/papers/:paperId',
    pathParams: paperParams,
    responses: {
      200: paperSchema,
      401: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Get paper by id',
  },
  updatePaper: {
    method: 'PATCH',
    path: '/conferences/:conferenceId/papers/:paperId',
    pathParams: paperParams,
    body: updatePaperSchema,
    responses: {
      200: paperSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Update draft paper metadata',
  },
  addAuthorship: {
    method: 'POST',
    path: '/conferences/:conferenceId/papers/:paperId/authorships',
    pathParams: paperParams,
    body: authorshipInputSchema,
    responses: {
      201: authorshipSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Add an author to a paper',
  },
  reorderAuthorships: {
    method: 'PATCH',
    path: '/conferences/:conferenceId/papers/:paperId/authorships/reorder',
    pathParams: paperParams,
    body: reorderAuthorshipsSchema,
    responses: {
      200: z.object({ data: z.array(authorshipSchema) }),
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Reorder authorship list',
  },
  removeAuthorship: {
    method: 'DELETE',
    path: '/conferences/:conferenceId/papers/:paperId/authorships/:authorshipId',
    pathParams: authorshipParams,
    body: c.noBody(),
    responses: {
      204: c.noBody(),
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Remove an author from a paper',
  },
  initiateVersion: {
    method: 'POST',
    path: '/conferences/:conferenceId/papers/:paperId/versions/initiate',
    pathParams: paperParams,
    body: initiateVersionSchema,
    responses: {
      200: initiateVersionResponseSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Get presigned upload URL for a paper version',
  },
  completeVersion: {
    method: 'POST',
    path: '/conferences/:conferenceId/papers/:paperId/versions/complete',
    pathParams: paperParams,
    body: completeVersionSchema,
    responses: {
      201: paperVersionSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Finalize upload and enqueue AV scan',
  },
  submitPaper: {
    method: 'POST',
    path: '/conferences/:conferenceId/papers/:paperId/submit',
    pathParams: paperParams,
    body: c.noBody(),
    responses: {
      200: submitPaperResponseSchema,
      400: problemEnvelopeSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
      409: problemEnvelopeSchema,
    },
    summary: 'Submit paper (DRAFT → SUBMITTED)',
  },
  downloadVersion: {
    method: 'GET',
    path: '/conferences/:conferenceId/papers/:paperId/versions/:versionId/download',
    pathParams: versionParams,
    responses: {
      200: presignedDownloadSchema,
      401: problemEnvelopeSchema,
      403: problemEnvelopeSchema,
      404: problemEnvelopeSchema,
    },
    summary: 'Get presigned download URL for a clean version',
  },
});

export type SubmissionContract = typeof submissionContract;
