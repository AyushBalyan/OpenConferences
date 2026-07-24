import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getConfig } from '@openconferences/config/env';
import { applyScanResult, withTenantContext } from '@openconferences/db';
import type { FileScanJobPayload } from '@openconferences/schemas';
import { scanBufferWithClamAV } from './clamav.js';
import { getS3Client } from './s3.client.js';

function filenameIndicatesInfection(originalFilename: string): boolean {
  const lower = originalFilename.toLowerCase();
  return lower.includes('eicar') || lower.includes('infected');
}

async function fetchObjectBytes(bucket: string, objectKey: string): Promise<Buffer> {
  const response = await getS3Client().send(
    new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
  );

  if (!response.Body) {
    throw new Error(`Empty S3 object: ${objectKey}`);
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Run AV scan. When ClamAV is disabled, uses a filename stub (tests/dev without clamd).
 * When enabled, fetches the uploaded object from S3 and scans via clamd INSTREAM.
 */
export async function runAvScan(payload: FileScanJobPayload): Promise<'CLEAN' | 'INFECTED'> {
  const config = getConfig();

  if (!config.clamav.enabled) {
    return filenameIndicatesInfection(payload.originalFilename) ? 'INFECTED' : 'CLEAN';
  }

  const asset = await withTenantContext({}, async (tx) =>
    tx.fileAsset.findFirst({
      where: { id: payload.fileAssetId },
      select: { bucket: true, objectKey: true },
    }),
  );

  if (!asset) {
    throw new Error(`FileAsset not found: ${payload.fileAssetId}`);
  }

  const bytes = await fetchObjectBytes(asset.bucket, asset.objectKey);
  return scanBufferWithClamAV(bytes, config.clamav.host, config.clamav.port);
}

export async function processFileScanJob(payload: FileScanJobPayload): Promise<void> {
  const scanStatus = await runAvScan(payload);

  await applyScanResult({
    fileAssetId: payload.fileAssetId,
    paperVersionId: payload.paperVersionId,
    paperId: payload.paperId,
    scanStatus,
  });
}
