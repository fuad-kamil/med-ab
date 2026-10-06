import { z } from 'zod';

export const createExamSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional().default(''),
  durationMinutes: z.number().min(1).max(480),
  shuffleQuestions: z.boolean().optional().default(false),
  shuffleOptions: z.boolean().optional().default(false),
  passMark: z.number().min(0).max(100).nullable().optional().default(null),
  allowedStudents: z.array(z.string()).optional().default([]),
  closeAction: z.enum(['block_new', 'force_submit']).optional().default('block_new'),
  categoryId: z.string().nullable().optional().default(null),
  language: z.enum(['en', 'am', 'ar']).optional().default('en'),
});

export const updateExamSchema = createExamSchema.partial();

export const updateStatusSchema = z.object({
  status: z.enum(['draft', 'open', 'closed']),
});
