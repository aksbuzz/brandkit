import { z } from 'zod';

// sharp supports up to 16383 px per side; stay well below that to bound worker memory.
const MAX_DIMENSION = 8192;

export const createPresetSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
    width: z.number().int().positive('Width must be a positive integer').max(MAX_DIMENSION),
    height: z.number().int().positive('Height must be a positive integer').max(MAX_DIMENSION),
    format: z.enum(['jpeg', 'webp', 'png']).default('jpeg'),
    quality: z.number().int().min(1).max(100).default(80),
  }),
});

export const updatePresetSchema = z.object({
  body: createPresetSchema.shape.body.partial(),
});

export const presetIdParamSchema = z.object({
  params: z.object({
    id: z.uuid(),
  }),
});

export type CreatePresetInput = z.infer<typeof createPresetSchema>['body'];
export type UpdatePresetInput = z.infer<typeof updatePresetSchema>['body'];
