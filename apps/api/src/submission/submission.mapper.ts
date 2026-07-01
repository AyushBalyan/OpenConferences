import type { Authorship, FileAsset, Paper, PaperVersion } from '@openconferences/db';
import type {
  AuthorshipDto,
  FileAssetDto,
  PaperDto,
  PaperVersionDto,
} from '@openconferences/schemas';

type PaperWithRelations = Paper & {
  authorships?: Authorship[];
  currentVersion?:
    | (PaperVersion & {
        fileAsset?: FileAsset;
      })
    | null;
  versions?: (PaperVersion & { fileAsset?: FileAsset })[];
};

export function mapFileAsset(asset: FileAsset): FileAssetDto {
  return {
    id: asset.id,
    bucket: asset.bucket,
    objectKey: asset.objectKey,
    sizeBytes: asset.sizeBytes.toString(),
    checksumSha256: asset.checksumSha256,
    mimeType: asset.mimeType,
    originalFilename: asset.originalFilename,
    scanStatus: asset.scanStatus,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export function mapPaperVersion(
  version: PaperVersion & { fileAsset?: FileAsset },
): PaperVersionDto {
  return {
    id: version.id,
    paperId: version.paperId,
    fileAssetId: version.fileAssetId,
    uploadedById: version.uploadedById,
    kind: version.kind,
    versionNumber: version.versionNumber,
    note: version.note,
    fileAsset: version.fileAsset ? mapFileAsset(version.fileAsset) : undefined,
    createdAt: version.createdAt.toISOString(),
  };
}

export function mapAuthorship(authorship: Authorship): AuthorshipDto {
  return {
    id: authorship.id,
    paperId: authorship.paperId,
    userId: authorship.userId,
    order: authorship.order,
    isCorresponding: authorship.isCorresponding,
    fullName: authorship.fullName,
    email: authorship.email,
    affiliation: authorship.affiliation,
    createdAt: authorship.createdAt.toISOString(),
    updatedAt: authorship.updatedAt.toISOString(),
  };
}

export function mapPaper(paper: PaperWithRelations): PaperDto {
  const latestCameraReady = paper.versions?.[0] ?? null;

  return {
    id: paper.id,
    organizationId: paper.organizationId,
    conferenceId: paper.conferenceId,
    trackId: paper.trackId,
    submittedById: paper.submittedById,
    currentVersionId: paper.currentVersionId,
    title: paper.title,
    abstract: paper.abstract,
    keywords: paper.keywords,
    status: paper.status,
    version: paper.version,
    authorships: paper.authorships?.map(mapAuthorship),
    currentVersion: paper.currentVersion ? mapPaperVersion(paper.currentVersion) : null,
    cameraReadyVersion: latestCameraReady ? mapPaperVersion(latestCameraReady) : null,
    createdAt: paper.createdAt.toISOString(),
    updatedAt: paper.updatedAt.toISOString(),
  };
}

export const PRIVILEGED_READER_ROLES = [
  'PLATFORM_ADMIN',
  'ORG_ADMIN',
  'ORGANIZER',
  'CHAIR',
] as const;

export function isPrivilegedReader(roles: string[]): boolean {
  return PRIVILEGED_READER_ROLES.some((role) => roles.includes(role));
}
