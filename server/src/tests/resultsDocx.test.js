import { describe, it, expect, vi } from 'vitest';
import { buildAttemptReportDocx } from '../controllers/resultsController.js';
import { Attempt } from '../models/Attempt.js';
import { Question } from '../models/Question.js';
import { Exam } from '../models/Exam.js';
import { ExamSnapshot } from '../models/ExamSnapshot.js';

describe('buildAttemptReportDocx', () => {
  it('should generate docx buffer without student ReferenceError', async () => {
    const mockAttempt = {
      _id: 'attempt123',
      studentId: { fullName: 'Abebe Bikila', studentId: 'STU101' },
      examId: { title: 'Fiqh 101', durationMinutes: 60, passMark: 50, language: 'ar' },
      answers: new Map(),
      manualGrades: new Map(),
      score: 80,
      totalMarks: 100,
      submittedAt: new Date(),
      startedAt: new Date(Date.now() - 30 * 60000),
    };

    vi.spyOn(Attempt, 'findById').mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(mockAttempt),
    });

    vi.spyOn(Question, 'find').mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        { _id: 'q1', text: 'Question 1', type: 'true_false', marks: 10, correctAnswer: 'true' }
      ]),
    });

    const { buffer, filename } = await buildAttemptReportDocx('attempt123');
    expect(buffer).toBeInstanceOf(Buffer);
    expect(filename).toContain('STU101');
    expect(filename).toContain('Fiqh_101');
  });
});
