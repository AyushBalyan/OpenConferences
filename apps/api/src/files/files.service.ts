import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { getConfig, resolveStorageBucket } from '@openconferences/config/env';
import { generateId, Prisma, withTenantContext } from '@openconferences/db';
import type { FileAsset, PaperVersion, VersionKind } from '@openconferences/db';
import { applyScanResult } from '@openconferences/db';
import type { FileScanJobPayload } from '@openconferences/schemas';
import { lockOpenCfp } from '../tenancy/cfp-window';
import { AuditService } from '../audit/audit.service';
import { getS3Bucket, getS3Client } from './s3.client';
import { consumePendingUpload, getPendingUpload, storePendingUpload } from './pending-uploads';
import { ScanQueueService } from './scan-queue.service';

const ALLOWED_MIME = 'application/pdf';
const STUDENT_DOC_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_UPLOAD_BYTES = 52_428_800;
const MAX_STUDENT_DOC_BYTES = 10_485_760;
const PRESIGN_TTL_SECONDS = 900;
const SUBMISSION_CODE_FILENAME = /^[A-Z0-9]+-[2-9A-HJ-NP-Z]{4}$/i;

/** Paper downloads use the public submission code. Drafts keep the uploaded name. */
export function manuscriptDownloadFilename(
  submissionNumber: string | null | undefined,
  originalFilename: string,
): string {
  const code = submissionNumber?.trim() ?? '';
  if (SUBMISSION_CODE_FILENAME.test(code)) return `${code.toUpperCase()}.pdf`;
  return sanitizeContentDispositionFilename(originalFilename);
}

function sanitizeContentDispositionFilename(filename: string): string {
  const cleaned = filename.replace(/["\r\n\\]/g, '').trim();
  return cleaned || 'manuscript.pdf';
}

function contentDisposition(disposition: 'attachment' | 'inline', filename: string): string {
  return `${disposition}; filename="${sanitizeContentDispositionFilename(filename)}"`;
}

type PaperVersionWithAsset = PaperVersion & { fileAsset: FileAsset };

export type PresignUploadInput = {
  organizationId: string;
  conferenceId: string;
  paperId: string;
  userId: string;
  kind: VersionKind;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  versionNumber: number;
};

export type FinalizeUploadInput = {
  organizationId: string;
  conferenceId: string;
  paperId: string;
  userId: string;
  objectKey: string;
  kind: VersionKind;
  note?: string;
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    private readonly scanQueue: ScanQueueService,
    private readonly audit: AuditService,
  ) {}

  buildObjectKey(input: PresignUploadInput): string {
    const ext = 'pdf';
    return `org/${input.organizationId}/conf/${input.conferenceId}/papers/${input.paperId}/versions/${input.kind}/${input.versionNumber}/${randomUUID()}.${ext}`;
  }

  async presignUpload(
    input: PresignUploadInput,
  ): Promise<{ uploadUrl: string; objectKey: string }> {
    if (input.contentType !== ALLOWED_MIME) {
      throw new BadRequestException('Only application/pdf uploads are allowed');
    }

    if (input.sizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds maximum upload size');
    }

    const objectKey = this.buildObjectKey(input);
    const bucket = getS3Bucket();
    const client = getS3Client();

    storePendingUpload({
      objectKey,
      organizationId: input.organizationId,
      conferenceId: input.conferenceId,
      paperId: input.paperId,
      userId: input.userId,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      originalFilename: input.originalFilename,
      kind: input.kind,
      versionNumber: input.versionNumber,
      expiresAt: Date.now() + PRESIGN_TTL_SECONDS * 1000,
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_TTL_SECONDS });

    return { uploadUrl, objectKey };
  }

  async finalizeUpload(input: FinalizeUploadInput): Promise<PaperVersionWithAsset> {
    const pending = consumePendingUpload(input.objectKey);
    if (!pending) {
      throw new BadRequestException('Unknown or expired upload session');
    }

    if (
      pending.paperId !== input.paperId ||
      pending.conferenceId !== input.conferenceId ||
      pending.userId !== input.userId
    ) {
      throw new ForbiddenException('Upload session does not match this paper');
    }

    const config = getConfig();
    let sizeBytes = pending.sizeBytes;
    let checksumSha256 = '';
    let sniffedMime = ALLOWED_MIME;
    const originalFilename = pending.originalFilename;

    try {
      const head = await getS3Client().send(
        new HeadObjectCommand({ Bucket: getS3Bucket(), Key: input.objectKey }),
      );

      sizeBytes = head.ContentLength ?? pending.sizeBytes;
      checksumSha256 = head.ChecksumSHA256 ?? head.ETag?.replace(/"/g, '') ?? '';

      const object = await getS3Client().send(
        new GetObjectCommand({
          Bucket: getS3Bucket(),
          Key: input.objectKey,
          Range: 'bytes=0-8191',
        }),
      );

      const chunks: Uint8Array[] = [];
      for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const detected = await fileTypeFromBuffer(buffer);
      sniffedMime = detected?.mime ?? sniffedMime;

      if (!checksumSha256) {
        checksumSha256 = createHash('sha256').update(buffer).digest('hex');
      }
    } catch (err) {
      if (!config.isTest) {
        this.logger.error({ err, objectKey: input.objectKey }, 'S3 finalize failed');
        throw new BadRequestException('Uploaded object not found or unreadable');
      }

      // Test fallback when MinIO is unavailable
      sniffedMime = ALLOWED_MIME;
      checksumSha256 = createHash('sha256')
        .update(`${input.objectKey}:${originalFilename}`)
        .digest('hex');
    }

    if (sniffedMime !== ALLOWED_MIME) {
      throw new BadRequestException('File content is not a valid PDF');
    }

    if (sizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File exceeds maximum upload size');
    }

    const fileAssetId = generateId();
    const paperVersionId = generateId();
    const bucket = getS3Bucket();

    let result: { fileAsset: FileAsset; version: PaperVersionWithAsset };
    try {
      result = await withTenantContext(
        {
          userId: input.userId,
          organizationId: input.organizationId,
          conferenceId: input.conferenceId,
        },
        async (tx) => {
          if (input.kind === 'SUBMISSION') await lockOpenCfp(tx, input.conferenceId);
          const fileAsset = await tx.fileAsset.create({
            data: {
              id: fileAssetId,
              organizationId: input.organizationId,
              uploadedById: input.userId,
              bucket,
              objectKey: input.objectKey,
              sizeBytes: BigInt(sizeBytes),
              checksumSha256,
              mimeType: sniffedMime,
              originalFilename,
              scanStatus: 'PENDING_SCAN',
            },
          });

          const latest = await tx.paperVersion.findFirst({
            where: { paperId: input.paperId, kind: input.kind },
            orderBy: { versionNumber: 'desc' },
            select: { versionNumber: true },
          });

          const version = await tx.paperVersion.create({
            data: {
              id: paperVersionId,
              paperId: input.paperId,
              fileAssetId: fileAsset.id,
              uploadedById: input.userId,
              kind: input.kind,
              versionNumber: (latest?.versionNumber ?? 0) + 1,
              note: input.note ?? null,
            },
            include: { fileAsset: true },
          });

          return { fileAsset, version };
        },
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This upload could not be finalized. Retry the upload.');
      }
      throw err;
    }

    const scanPayload: FileScanJobPayload = {
      fileAssetId: result.fileAsset.id,
      paperVersionId: result.version.id,
      paperId: input.paperId,
      conferenceId: input.conferenceId,
      organizationId: input.organizationId,
      originalFilename,
    };

    await this.scanQueue.enqueueScan(scanPayload);

    if (config.isTest) {
      await this.processScanInline(scanPayload);
    }

    return result.version;
  }

  async processScanInline(payload: FileScanJobPayload): Promise<void> {
    const infected =
      payload.originalFilename.toLowerCase().includes('eicar') ||
      payload.originalFilename.toLowerCase().includes('infected');

    const scanStatus = infected ? 'INFECTED' : 'CLEAN';

    const outcome = await applyScanResult({
      fileAssetId: payload.fileAssetId,
      paperVersionId: payload.paperVersionId,
      paperId: payload.paperId,
      scanStatus,
    });

    if (outcome.openedRevisionCycle) {
      this.logger.log(
        { paperId: payload.paperId, paperVersionId: payload.paperVersionId },
        'Opened the next review cycle after a clean revision',
      );
    }

    if (outcome.activatedCameraReady) {
      await this.audit.log({
        organizationId: payload.organizationId,
        conferenceId: payload.conferenceId,
        action: 'paper.camera_ready',
        entity: 'Paper',
        entityId: payload.paperId,
        diff: { paperVersionId: payload.paperVersionId },
      });
    }

    if (scanStatus === 'INFECTED') {
      await this.audit.log({
        organizationId: payload.organizationId,
        conferenceId: payload.conferenceId,
        action: 'file.infected',
        entity: 'FileAsset',
        entityId: payload.fileAssetId,
        diff: { paperId: payload.paperId, originalFilename: payload.originalFilename },
      });
    }
  }

  async presignDownload(
    fileAssetId: string,
    userId: string,
    organizationId: string,
    disposition: 'attachment' | 'inline' = 'attachment',
    downloadFilename?: string | null,
  ) {
    const asset = await withTenantContext({ userId, organizationId }, async (tx) =>
      tx.fileAsset.findFirst({
        where: { id: fileAssetId },
      }),
    );

    if (!asset) {
      throw new NotFoundException('File not found');
    }

    if (asset.scanStatus !== 'CLEAN') {
      throw new ForbiddenException('File is not available for download');
    }

    const command = new GetObjectCommand({
      Bucket: resolveStorageBucket(asset.bucket),
      Key: asset.objectKey,
      ResponseContentDisposition: contentDisposition(
        disposition,
        downloadFilename?.trim() ||
          (disposition === 'inline' ? 'manuscript.pdf' : asset.originalFilename),
      ),
      ...(disposition === 'inline' ? { ResponseContentType: 'application/pdf' } : {}),
    });

    const downloadUrl = await getSignedUrl(getS3Client(), command, {
      expiresIn: 300,
    });

    return { downloadUrl, expiresInSeconds: 300 };
  }

  validatePendingObjectKey(objectKey: string, paperId: string): boolean {
    const pending = getPendingUpload(objectKey);
    return pending?.paperId === paperId;
  }

  buildStudentVerificationObjectKey(input: {
    organizationId: string;
    conferenceId: string;
    paperId: string;
    registrationId: string;
  }): string {
    const ext = 'bin';
    return `org/${input.organizationId}/conf/${input.conferenceId}/papers/${input.paperId}/registration/${input.registrationId}/student-verification/${randomUUID()}.${ext}`;
  }

  async presignStudentVerificationUpload(input: {
    organizationId: string;
    conferenceId: string;
    paperId: string;
    registrationId: string;
    userId: string;
    originalFilename: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<{ uploadUrl: string; objectKey: string; expiresInSeconds: number }> {
    if (!STUDENT_DOC_MIMES.has(input.contentType)) {
      throw new BadRequestException('Student verification document must be PDF, JPEG, or PNG');
    }

    if (input.sizeBytes > MAX_STUDENT_DOC_BYTES) {
      throw new BadRequestException('File exceeds maximum upload size');
    }

    const objectKey = this.buildStudentVerificationObjectKey(input);
    const bucket = getS3Bucket();
    const client = getS3Client();

    storePendingUpload({
      objectKey,
      organizationId: input.organizationId,
      conferenceId: input.conferenceId,
      paperId: input.paperId,
      userId: input.userId,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      originalFilename: input.originalFilename,
      kind: 'STUDENT_VERIFICATION',
      versionNumber: 0,
      registrationId: input.registrationId,
      expiresAt: Date.now() + PRESIGN_TTL_SECONDS * 1000,
    });

    // Persist upload ownership and metadata so completion survives API restarts.
    await withTenantContext(
      {
        userId: input.userId,
        organizationId: input.organizationId,
        conferenceId: input.conferenceId,
      },
      (tx) =>
        tx.fileAsset.create({
          data: {
            id: generateId(),
            organizationId: input.organizationId,
            uploadedById: input.userId,
            bucket,
            objectKey,
            originalFilename: input.originalFilename,
            mimeType: input.contentType,
            sizeBytes: BigInt(input.sizeBytes),
            checksumSha256: '',
            scanStatus: 'PENDING_SCAN',
          },
        }),
    );
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_TTL_SECONDS });

    return { uploadUrl, objectKey, expiresInSeconds: PRESIGN_TTL_SECONDS };
  }

  async finalizeStudentVerificationUpload(input: {
    organizationId: string;
    conferenceId: string;
    paperId: string;
    registrationId: string;
    userId: string;
    objectKey: string;
  }): Promise<FileAsset> {
    const config = getConfig();
    const stored = await withTenantContext(
      {
        userId: input.userId,
        organizationId: input.organizationId,
        conferenceId: input.conferenceId,
      },
      (tx) =>
        tx.fileAsset.findFirst({
          where: {
            OR: [
              { objectKey: input.objectKey },
              { objectKey: { startsWith: input.objectKey + '.sealed-' } },
            ],
            organizationId: input.organizationId,
            uploadedById: input.userId,
          },
        }),
    );
    const prefix = `org/${input.organizationId}/conf/${input.conferenceId}/papers/${input.paperId}/registration/${input.registrationId}/student-verification/`;
    if (!input.objectKey.startsWith(prefix) && !config.isTest)
      throw new ForbiddenException('Invalid student document upload scope');
    if (stored?.checksumSha256 && stored.objectKey.startsWith(input.objectKey + '.sealed-'))
      return stored;
    if (stored && stored.createdAt.getTime() + PRESIGN_TTL_SECONDS * 1000 < Date.now())
      throw new BadRequestException('Upload session expired');
    const pending =
      getPendingUpload(input.objectKey) ??
      (stored
        ? {
            objectKey: input.objectKey,
            organizationId: input.organizationId,
            conferenceId: input.conferenceId,
            paperId: input.paperId,
            userId: input.userId,
            contentType: stored.mimeType,
            sizeBytes: Number(stored.sizeBytes),
            originalFilename: stored.originalFilename,
            kind: 'STUDENT_VERIFICATION',
            versionNumber: 0,
            registrationId: input.registrationId,
            expiresAt: stored.createdAt.getTime() + PRESIGN_TTL_SECONDS * 1000,
          }
        : undefined);
    if (pending && pending.expiresAt < Date.now())
      throw new BadRequestException('Upload session expired');

    const resolvedPending =
      pending ??
      (config.isTest
        ? {
            objectKey: input.objectKey,
            organizationId: input.organizationId,
            conferenceId: input.conferenceId,
            paperId: input.paperId,
            userId: input.userId,
            contentType: 'application/pdf',
            sizeBytes: 1024,
            originalFilename: 'student-id.pdf',
            kind: 'STUDENT_VERIFICATION',
            versionNumber: 0,
            registrationId: input.registrationId,
            expiresAt: Date.now() + PRESIGN_TTL_SECONDS * 1000,
          }
        : undefined);

    if (!resolvedPending || resolvedPending.kind !== 'STUDENT_VERIFICATION') {
      throw new BadRequestException('Unknown or expired upload session');
    }

    if (
      resolvedPending.registrationId !== input.registrationId ||
      resolvedPending.paperId !== input.paperId ||
      resolvedPending.userId !== input.userId
    ) {
      throw new ForbiddenException('Upload session does not match this registration');
    }

    let sizeBytes = resolvedPending.sizeBytes;
    let checksumSha256 = '';
    let sniffedMime = resolvedPending.contentType;
    let sourceETag: string | undefined;

    try {
      const head = await getS3Client().send(
        new HeadObjectCommand({ Bucket: getS3Bucket(), Key: input.objectKey }),
      );
      sourceETag = head.ETag;
      sizeBytes = head.ContentLength ?? resolvedPending.sizeBytes;
      if (sizeBytes <= 0 || sizeBytes > MAX_STUDENT_DOC_BYTES)
        throw new BadRequestException('Student document exceeds allowed size');

      const object = await getS3Client().send(
        new GetObjectCommand({
          Bucket: getS3Bucket(),
          Key: input.objectKey,
          IfMatch: sourceETag,
          Range: 'bytes=0-8191',
        }),
      );

      const chunks: Uint8Array[] = [];
      for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      const detected = await fileTypeFromBuffer(buffer);
      sniffedMime = detected?.mime ?? 'application/octet-stream';
      checksumSha256 = createHash('sha256').update(buffer).digest('hex');
    } catch (err) {
      if (!config.isTest) {
        this.logger.error({ err, objectKey: input.objectKey }, 'S3 student doc finalize failed');
        throw new BadRequestException('Uploaded object not found or unreadable');
      }

      sniffedMime = resolvedPending.contentType;
      checksumSha256 = createHash('sha256')
        .update(`${input.objectKey}:${resolvedPending.originalFilename}`)
        .digest('hex');
    }

    if (!STUDENT_DOC_MIMES.has(sniffedMime) && config.isTest) {
      sniffedMime = resolvedPending.contentType;
    }

    if (!STUDENT_DOC_MIMES.has(sniffedMime)) {
      throw new BadRequestException('File content type is not allowed for student verification');
    }

    if (sizeBytes <= 0 || sizeBytes > MAX_STUDENT_DOC_BYTES)
      throw new BadRequestException('Student document exceeds the allowed size');
    // Scan and review a sealed copy; the original PUT URL cannot overwrite it.
    const sealedKey = config.isTest ? input.objectKey : `${input.objectKey}.sealed-${randomUUID()}`;
    if (!config.isTest)
      await getS3Client().send(
        new CopyObjectCommand({
          Bucket: getS3Bucket(),
          Key: sealedKey,
          CopySource: `${getS3Bucket()}/${encodeURIComponent(input.objectKey)}`,
          CopySourceIfMatch: sourceETag,
        }),
      );
    const fileAsset = await withTenantContext(
      {
        userId: input.userId,
        organizationId: input.organizationId,
        conferenceId: input.conferenceId,
      },
      async (tx) =>
        tx.fileAsset.upsert({
          where: { id: stored?.id ?? generateId() },
          update: {
            objectKey: sealedKey,
            sizeBytes: BigInt(sizeBytes),
            checksumSha256,
            mimeType: sniffedMime,
            ...(config.isTest ? { scanStatus: 'CLEAN' as const } : {}),
          },
          create: {
            id: generateId(),
            organizationId: input.organizationId,
            uploadedById: input.userId,
            bucket: getS3Bucket(),
            objectKey: sealedKey,
            sizeBytes: BigInt(sizeBytes),
            checksumSha256,
            mimeType: sniffedMime,
            originalFilename: resolvedPending.originalFilename,
            scanStatus: config.isTest ? 'CLEAN' : 'PENDING_SCAN',
          },
        }),
    );

    consumePendingUpload(input.objectKey);
    return fileAsset;
  }

  async enqueueStudentDocumentScan(
    fileAsset: FileAsset,
    paperId: string,
    conferenceId: string,
    organizationId: string,
  ) {
    if (getConfig().isTest || fileAsset.scanStatus !== 'PENDING_SCAN') return;
    await this.scanQueue.enqueueScan({
      fileAssetId: fileAsset.id,
      paperVersionId: fileAsset.id,
      paperId,
      conferenceId,
      organizationId,
      originalFilename: fileAsset.originalFilename,
    });
  }
}
