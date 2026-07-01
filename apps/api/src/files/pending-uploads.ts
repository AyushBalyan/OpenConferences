type PendingUpload = {
  objectKey: string;
  organizationId: string;
  conferenceId: string;
  paperId: string;
  userId: string;
  contentType: string;
  sizeBytes: number;
  originalFilename: string;
  kind: string;
  versionNumber: number;
  registrationId?: string;
  expiresAt: number;
};

const pendingUploads =
  (globalThis as { __ocPendingUploads?: Map<string, PendingUpload> }).__ocPendingUploads ??
  new Map<string, PendingUpload>();

(globalThis as { __ocPendingUploads?: Map<string, PendingUpload> }).__ocPendingUploads =
  pendingUploads;

export function storePendingUpload(upload: PendingUpload): void {
  pendingUploads.set(upload.objectKey, upload);
}

export function consumePendingUpload(objectKey: string): PendingUpload | undefined {
  const upload = pendingUploads.get(objectKey);
  if (upload) {
    pendingUploads.delete(objectKey);
  }
  return upload;
}

export function getPendingUpload(objectKey: string): PendingUpload | undefined {
  return pendingUploads.get(objectKey);
}

export type { PendingUpload };
