import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const Counter = mongoose.model('Counter', counterSchema);

/**
 * Format sequence number to canonical STU-XX string
 * e.g. 1 -> STU-01, 99 -> STU-99, 100 -> STU-100
 */
export function formatStudentId(seq) {
  const numStr = String(seq).padStart(2, '0');
  return `STU-${numStr}`;
}

/**
 * Atomically fetch the next single student ID from Counter
 */
export async function getNextStudentId() {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'studentId' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return formatStudentId(counter.seq);
}

/**
 * Atomically reserve a block of N student IDs
 * Returns array of formatted student IDs in order [STU-01, STU-02, ...]
 */
export async function reserveStudentIdBlock(count) {
  if (count <= 0) return [];
  const counter = await Counter.findOneAndUpdate(
    { _id: 'studentId' },
    { $inc: { seq: count } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const startSeq = counter.seq - count + 1;
  const ids = [];
  for (let i = 0; i < count; i++) {
    ids.push(formatStudentId(startSeq + i));
  }
  return ids;
}

/**
 * Normalize common typing variants of student IDs before lookup
 * e.g. "stu-1", "STU1", "stu01", "stu 01", "  STU-01 " -> "STU-01"
 */
export function normalizeStudentId(input) {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim().toUpperCase();
  const noSpaces = trimmed.replace(/\s+/g, '');
  const stripped = noSpaces.replace(/^STU[\s-]*\/?/i, '');

  if (stripped.length > 0 && /^\d+$/.test(stripped)) {
    const num = parseInt(stripped, 10);
    if (!isNaN(num) && num > 0) {
      return formatStudentId(num);
    }
  }
  return trimmed;
}
