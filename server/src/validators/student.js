import { z } from 'zod';

export const studentLoginSchema = z.object({
  accessToken: z.string().trim().min(1, 'Exam access token is required'),
  studentId: z.string().trim().min(1, 'Student ID is required'),
  password: z.string().min(1, 'Password is required'),
});

export const saveProgressSchema = z.object({
  answers: z.record(z.any()).optional(),
  flaggedQuestions: z.array(z.string()).optional(),
  tabSwitchCount: z.number().nonnegative().optional(),
});
