import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatStudentId, normalizeStudentId } from '../models/Counter.js';

describe('Student ID Format & Normalization', () => {
  it('formats sequence numbers correctly', () => {
    expect(formatStudentId(1)).toBe('STU-01');
    expect(formatStudentId(9)).toBe('STU-09');
    expect(formatStudentId(10)).toBe('STU-10');
    expect(formatStudentId(99)).toBe('STU-99');
    expect(formatStudentId(100)).toBe('STU-100');
    expect(formatStudentId(101)).toBe('STU-101');
  });

  it('normalizes student login inputs forgivingly', () => {
    expect(normalizeStudentId('stu-1')).toBe('STU-01');
    expect(normalizeStudentId('STU1')).toBe('STU-01');
    expect(normalizeStudentId('stu01')).toBe('STU-01');
    expect(normalizeStudentId('stu 01')).toBe('STU-01');
    expect(normalizeStudentId(' STU-01 ')).toBe('STU-01');
    expect(normalizeStudentId('stu-100')).toBe('STU-100');
    expect(normalizeStudentId('STU100')).toBe('STU-100');
    expect(normalizeStudentId('STU-99')).toBe('STU-99');
  });

  it('preserves non-standard string formats as uppercase trimmed', () => {
    expect(normalizeStudentId('  custom-id-123 ')).toBe('CUSTOM-ID-123');
  });
});
