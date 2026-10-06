import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional().default(''),
});

export const updateCategorySchema = createCategorySchema.partial();
