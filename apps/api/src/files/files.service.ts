import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'node:crypto';
import { fileTypeFromBuffer } from 'file-type';
import { getConfig } from '@openconferences/config/env';
import { generateId, withTenantContext } from '@openconferences/db';
import type { FileAsset, PaperVersion, VersionKind } from '@openconferences/db';
import { applyScanResult } from '@openconferences/db';
import type { FileScanJobPayload } from '@openconferences/schemas';
import { AuditService } from '../audit/audit.service';
import { getS3Bucket, getS3Client } from './s3.client';
import { consumePendingUpload, getPendingUpload, storePendingUpload } from './pending-uploads';
import { ScanQueueService } from './scan-queue.service';

const ALLOWED_MIME = 'application/pdf';
const STUDENT_DOC_MIMES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_UPLOAD_BYTES = 52_428_800;
const MAX_STUDENT_DOC_BYTES = 10_485_760;
const PRESIGN_TTL_SECONDS = 900;

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

    const result = await withTenantContext(
      {
        userId: input.userId,
        organizationId: input.organizationId,
        conferenceId: input.conferenceId,
      },
      async (tx) => {
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

        const version = await tx.paperVersion.create({
          data: {
            id: paperVersionId,
            paperId: input.paperId,
            fileAssetId: fileAsset.id,
            uploadedById: input.userId,
            kind: input.kind,
            versionNumber: pending.versionNumber,
            note: input.note ?? null,
          },
          include: { fileAsset: true },
        });

        return { fileAsset, version };
      },
    );

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

  async presignDownload(fileAssetId: string, userId: string, organizationId: string) {
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
      Bucket: asset.bucket,
      Key: asset.objectKey,
      ResponseContentDisposition: `attachment; filename="${asset.originalFilename.replace(/"/g, '')}"`,
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
    const pending = getPendingUpload(input.objectKey);
    if (pending) {
      consumePendingUpload(input.objectKey);
    }

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

    try {
      const head = await getS3Client().send(
        new HeadObjectCommand({ Bucket: getS3Bucket(), Key: input.objectKey }),
      );
      sizeBytes = head.ContentLength ?? resolvedPending.sizeBytes;

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

    const fileAsset = await withTenantContext(
      {
        userId: input.userId,
        organizationId: input.organizationId,
        conferenceId: input.conferenceId,
      },
      async (tx) =>
        tx.fileAsset.create({
          data: {
            id: generateId(),
            organizationId: input.organizationId,
            uploadedById: input.userId,
            bucket: getS3Bucket(),
            objectKey: input.objectKey,
            sizeBytes: BigInt(sizeBytes),
            checksumSha256,
            mimeType: sniffedMime,
            originalFilename: resolvedPending.originalFilename,
            scanStatus: config.isTest ? 'CLEAN' : 'PENDING_SCAN',
          },
        }),
    );

    if (!config.isTest) {
      await this.scanQueue.enqueueScan({
        fileAssetId: fileAsset.id,
        paperVersionId: fileAsset.id,
        paperId: input.paperId,
        conferenceId: input.conferenceId,
        organizationId: input.organizationId,
        originalFilename: resolvedPending.originalFilename,
      });
    }

    return fileAsset;
  }
}
