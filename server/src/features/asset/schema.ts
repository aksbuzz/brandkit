import { z } from 'zod';
import { config } from '../../config';

export const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
] as const;

export type AllowedContentType = (typeof ALLOWED_CONTENT_TYPES)[number];

// The S3 key never contains the user's filename; the display name lives only in the database.
export const EXTENSION_BY_CONTENT_TYPE: Record<AllowedContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export const createAssetSchema = z.object({
  body: z.object({
    filename: z.string().trim().min(1, 'Filename is required').max(255, 'Filename is too long'),
    fileSizeBytes: z
      .number()
      .int()
      .positive('File size must be a positive integer')
      .max(config.upload.maxBytes, `File must be at most ${config.upload.maxBytes} bytes`),
    contentType: z.enum(ALLOWED_CONTENT_TYPES, {
      error: `Content type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}`,
    }),
  }),
});

export const listAssetsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

export const assetIdParamSchema = z.object({
  params: z.object({
    assetId: z.uuid(),
  }),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>['body'];
export type ListAssetsQuery = z.infer<typeof listAssetsSchema>['query'];
export type AssetIdParams = z.infer<typeof assetIdParamSchema>['params'];
