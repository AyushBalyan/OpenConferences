import { S3Client } from '@aws-sdk/client-s3';
import { getConfig } from '@openconferences/config/env';

let client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!client) {
    const config = getConfig();
    client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      forcePathStyle: config.s3.forcePathStyle,
    });
  }
  return client;
}

export function getS3Bucket(): string {
  return getConfig().s3.bucket;
}
