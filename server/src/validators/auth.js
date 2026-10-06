import { z } from 'zod';

export const adminLoginSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100),
  password: z.string().min(1, 'Password is required'),
});

export const studentExamLoginSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required').trim(),
  password: z.string().min(1, 'Password is required'),
});
