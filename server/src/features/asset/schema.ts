import { z } from 'zod';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'] as const;

export const createAssetSchema = z.object({
  body: z.object({
    filename: z.string().min(1, 'Filename is required'),
    fileSizeBytes: z.number().int().positive('File size must be a positive integer'),
    contentType: z.enum(ALLOWED_CONTENT_TYPES, {
      errorMap: () => ({ message: `Content type must be one of: ${ALLOWED_CONTENT_TYPES.join(', ')}` }),
    }),
  }),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>['body'];
