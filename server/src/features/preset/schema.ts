import { z } from 'zod';

export const createPresetSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    width: z.number().int().positive('Width must be a positive integer'),
    height: z.number().int().positive('Height must be a positive integer'),
    fit: z.enum(['cover', 'contain', 'fill', 'inside', 'outside']).default('cover'),
    format: z.enum(['jpeg', 'webp', 'png']).default('jpeg'),
    quality: z.number().int().min(1).max(100).default(80),
  }),
});

export const updatePresetSchema = z.object({
  body: createPresetSchema.shape.body.partial(),
});

export type CreatePresetInput = z.infer<typeof createPresetSchema>['body'];
export type UpdatePresetInput = z.infer<typeof updatePresetSchema>['body'];
