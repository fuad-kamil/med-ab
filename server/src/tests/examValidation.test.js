import { describe, it, expect } from 'vitest';
import { createExamSchema, updateExamSchema } from '../validators/exam.js';

describe('Exam Validation Schema', () => {
  it('should validate and include language field on create', () => {
    const data = {
      title: 'Test Exam',
      durationMinutes: 60,
      language: 'ar',
    };
    const parsed = createExamSchema.parse(data);
    expect(parsed.language).toBe('ar');
  });

  it('should allow amharic language on update', () => {
    const data = {
      language: 'am',
    };
    const parsed = updateExamSchema.parse(data);
    expect(parsed.language).toBe('am');
  });

  it('should default language to en when omitted on create', () => {
    const data = {
      title: 'Test Exam',
      durationMinutes: 60,
    };
    const parsed = createExamSchema.parse(data);
    expect(parsed.language).toBe('en');
  });
});
