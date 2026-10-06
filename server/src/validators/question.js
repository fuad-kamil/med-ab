import { z } from 'zod';

const optionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(2000).trim(),
});

export const createQuestionSchema = z
  .object({
    type: z.enum(['mcq_single', 'mcq_multi', 'true_false', 'short_answer']),
    text: z.string().min(1).max(5000).trim(),
    options: z.array(optionSchema).optional().default([]),
    correctAnswer: z.union([z.string(), z.array(z.string())]),
    marks: z.number().min(0.5).optional().default(1),
    explanation: z.string().max(2000).trim().optional().default(''),
  })
  .refine(
    (data) => {
      if (['mcq_single', 'mcq_multi', 'true_false'].includes(data.type)) {
        return data.options.length >= 2;
      }
      return true;
    },
    { message: 'MCQ and true/false questions require at least 2 options' }
  );

export const updateQuestionSchema = createQuestionSchema;

export const reorderQuestionsSchema = z.object({
  questionIds: z.array(z.string()).min(1),
});

export const importQuestionsSchema = z.object({
  questions: z.array(createQuestionSchema).min(1),
});
