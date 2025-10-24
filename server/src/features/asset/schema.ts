import { z } from 'zod';

export const createAssetSchema = z.object({
  body: z.object({
    filename: z.string().min(1, 'Filename is required'),
    contentType: z.string().regex(/^image\/.+/, 'Content type must be an image type'),
  }),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>['body'];
