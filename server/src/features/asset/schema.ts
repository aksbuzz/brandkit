import { z } from 'zod';

export const createAssetSchema = z.object({
  body: z.object({
    filename: z.string().min(1, 'Filename is required'),
    fileSizeBytes: z.number().int().positive('File size must be a positive integer'),
    contentType: z.string().regex(/^image\/.+/, 'Content type must be an image type'),
  }),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>['body'];
