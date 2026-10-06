import { z } from 'zod';

export const createUserSchema = z.object({
  studentId: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().min(1).max(50).trim().optional()
  ),
  fullName: z.string().min(1).max(100).trim(),
  email: z.string().email('Invalid email address').or(z.literal('')).optional().default(''),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100),
  categoryIds: z.array(z.string()).optional().default([]),
  gender: z.enum(['male', 'female']).nullable().optional(),
});

export const updateUserSchema = z.object({
  studentId: z.string().min(1).max(50).trim().optional(),
  fullName: z.string().min(1).max(100).trim().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')).optional(),
  isActive: z.boolean().optional(),
  categoryIds: z.array(z.string()).optional(),
  gender: z.enum(['male', 'female']).nullable().optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6).max(100).optional(),
  // If no newPassword provided, one will be auto-generated
});

export const userQuerySchema = z.object({
  page: z.preprocess((v) => (v === '' || v === undefined ? 1 : Number(v)), z.number().min(1).default(1)),
  limit: z.preprocess((v) => (v === '' || v === undefined ? 50 : Number(v)), z.number().min(1).max(1000).default(50)),
  search: z.string().optional(),
  active: z
    .enum(['true', 'false', 'all'])
    .default('all')
    .transform((v) => (v === 'all' ? undefined : v === 'true')),
  categoryId: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  sortBy: z.enum(['studentId', 'fullName', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
