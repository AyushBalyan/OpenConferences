import { z } from 'zod';

export const paperStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'DECISION_MADE',
  'CAMERA_READY',
  'WITHDRAWN',
  'WITHDRAWN_NONPAYMENT',
]);

export const versionKindSchema = z.enum([
  'SUBMISSION',
  'REVISION',
  'CAMERA_READY',
  'SUPPLEMENTARY',
]);

export const fileScanStatusSchema = z.enum(['PENDING_SCAN', 'CLEAN', 'INFECTED']);

export const createPaperSchema = z.object({
  trackId: z.string().uuid(),
  title: z.string().min(1).max(500),
  abstract: z.string().min(1).max(10000),
  keywords: z.array(z.string().min(1).max(100)).max(20).default([]),
});

export type CreatePaperInput = z.infer<typeof createPaperSchema>;

export const updatePaperSchema = z.object({
  trackId: z.string().uuid().optional(),
  title: z.string().min(1).max(500).optional(),
  abstract: z.string().min(1).max(10000).optional(),
  keywords: z.array(z.string().min(1).max(100)).max(20).optional(),
  version: z.number().int().nonnegative(),
});

export type UpdatePaperInput = z.infer<typeof updatePaperSchema>;

export const authorshipInputSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  fullName: z.string().min(1).max(255),
  email: z.string().email(),
  affiliation: z.string().max(500).optional(),
  isCorresponding: z.boolean().default(false),
});

export type AuthorshipInput = z.infer<typeof authorshipInputSchema>;

export const authorshipSchema = z.object({
  id: z.string().uuid(),
  paperId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  order: z.number().int().positive(),
  isCorresponding: z.boolean(),
  fullName: z.string(),
  email: z.string().email(),
  affiliation: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AuthorshipDto = z.infer<typeof authorshipSchema>;

export const reorderAuthorshipsSchema = z.object({
  authorshipIds: z.array(z.string().uuid()).min(1),
});

export type ReorderAuthorshipsInput = z.infer<typeof reorderAuthorshipsSchema>;

export const fileAssetSchema = z.object({
  id: z.string().uuid(),
  bucket: z.string(),
  objectKey: z.string(),
  sizeBytes: z.string(),
  checksumSha256: z.string(),
  mimeType: z.string(),
  originalFilename: z.string(),
  scanStatus: fileScanStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type FileAssetDto = z.infer<typeof fileAssetSchema>;

export const paperVersionSchema = z.object({
  id: z.string().uuid(),
  paperId: z.string().uuid(),
  fileAssetId: z.string().uuid(),
  uploadedById: z.string().uuid(),
  kind: versionKindSchema,
  versionNumber: z.number().int().positive(),
  note: z.string().nullable(),
  fileAsset: fileAssetSchema.optional(),
  createdAt: z.string().datetime(),
});

export type PaperVersionDto = z.infer<typeof paperVersionSchema>;

export const paperSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  trackId: z.string().uuid(),
  submittedById: z.string().uuid(),
  currentVersionId: z.string().uuid().nullable(),
  title: z.string(),
  abstract: z.string(),
  keywords: z.array(z.string()),
  status: paperStatusSchema,
  version: z.number().int(),
  authorships: z.array(authorshipSchema).optional(),
  currentVersion: paperVersionSchema.nullable().optional(),
  cameraReadyVersion: paperVersionSchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PaperDto = z.infer<typeof paperSchema>;

export const paperListSchema = z.object({
  data: z.array(paperSchema),
  nextCursor: z.string().uuid().nullable(),
});

export const initiateVersionSchema = z.object({
  kind: versionKindSchema.default('SUBMISSION'),
  originalFilename: z.string().min(1).max(255),
  contentType: z.literal('application/pdf'),
  sizeBytes: z.number().int().positive().max(52_428_800),
});

export type InitiateVersionInput = z.infer<typeof initiateVersionSchema>;

export const initiateVersionResponseSchema = z.object({
  uploadUrl: z.string().url(),
  objectKey: z.string(),
  expiresInSeconds: z.number().int().positive(),
});

export type InitiateVersionResponse = z.infer<typeof initiateVersionResponseSchema>;

export const completeVersionSchema = z.object({
  objectKey: z.string().min(1),
  kind: versionKindSchema.default('SUBMISSION'),
  note: z.string().max(1000).optional(),
});

export type CompleteVersionInput = z.infer<typeof completeVersionSchema>;

export const presignedDownloadSchema = z.object({
  downloadUrl: z.string().url(),
  expiresInSeconds: z.number().int().positive(),
});

export type PresignedDownloadResponse = z.infer<typeof presignedDownloadSchema>;

export const submitPaperResponseSchema = z.object({
  paper: paperSchema,
  message: z.string(),
});

/** Shared file scan job payload for pg-boss queue */
export const fileScanJobPayloadSchema = z.object({
  fileAssetId: z.string().uuid(),
  paperVersionId: z.string().uuid(),
  paperId: z.string().uuid(),
  conferenceId: z.string().uuid(),
  organizationId: z.string().uuid(),
  originalFilename: z.string(),
});

export type FileScanJobPayload = z.infer<typeof fileScanJobPayloadSchema>;

export const FILE_SCAN_JOB_NAME = 'file.scan' as const;
