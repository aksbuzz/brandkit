import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost, PresignedPost } from '@aws-sdk/s3-presigned-post';
import { config } from '../config';

const s3Client = new S3Client({ region: config.aws.region });

const UPLOAD_URL_TTL_SECONDS = 15 * 60;

/**
 * Presigned POST (not PUT) so S3 itself rejects objects outside the size window or with a
 * different Content-Type than the one that was declared when the asset was created.
 */
export const createUploadPost = (key: string, contentType: string): Promise<PresignedPost> =>
  createPresignedPost(s3Client, {
    Bucket: config.aws.s3.bucket,
    Key: key,
    Expires: UPLOAD_URL_TTL_SECONDS,
    Fields: { 'Content-Type': contentType },
    Conditions: [
      ['content-length-range', 1, config.upload.maxBytes],
      ['eq', '$Content-Type', contentType],
    ],
  });
