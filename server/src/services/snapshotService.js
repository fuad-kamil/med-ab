import { ExamSnapshot } from '../models/ExamSnapshot.js';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { Category } from '../models/Category.js';

/**
 * Gets an existing active snapshot for an exam or creates a new one from current exam & question data.
 */
export async function getOrCreateExamSnapshot(examId) {
  let snapshot = await ExamSnapshot.findOne({ examId, deletedAt: null }).sort({ createdAt: -1 });
  if (snapshot) {
    return snapshot;
  }

  const exam = await Exam.findById(examId).populate('categoryId', 'name').lean();
  if (!exam) {
    return null;
  }

  const questions = await Question.find({ examId }).sort({ order: 1 }).lean();
  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 1), 0);

  const formattedQuestions = questions.map((q) => ({
    _id: q._id,
    type: q.type,
    text: q.text,
    options: (q.options || []).map((opt) => ({
      id: opt.id,
      text: opt.text,
    })),
    correctAnswer: q.correctAnswer,
    marks: q.marks || 1,
    explanation: q.explanation || '',
    order: q.order || 0,
  }));

  const categoryName = exam.categoryId?.name || 'Uncategorized';

  snapshot = await ExamSnapshot.create({
    examId: exam._id,
    title: exam.title,
    description: exam.description || '',
    subject: exam.subject || '',
    categoryId: exam.categoryId?._id || exam.categoryId || null,
    categoryName,
    durationMinutes: exam.durationMinutes || 30,
    passMark: exam.passMark ?? exam.passingMark ?? 50,
    totalMarks,
    resultsVisibility: exam.resultsVisibility || 'hidden',
    language: exam.language || 'en',
    questions: formattedQuestions,
  });

  return snapshot;
}

/**
 * Ensures an attempt is linked to a snapshot and has denormalized fields populated.
 */
export async function ensureSnapshotForAttempt(attempt) {
  if (attempt.snapshotId && attempt.examTitle) {
    return attempt;
  }

  const snapshot = await getOrCreateExamSnapshot(attempt.examId);
  if (snapshot) {
    attempt.snapshotId = snapshot._id;
    attempt.examTitle = snapshot.title;
    attempt.categoryName = snapshot.categoryName;
    attempt.passMark = snapshot.passMark;
    if (!attempt.totalMarks) {
      attempt.totalMarks = snapshot.totalMarks;
    }
    await attempt.save();
  }
  return attempt;
}
