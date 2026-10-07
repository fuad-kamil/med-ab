import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { Attempt } from '../models/Attempt.js';
import { ApiError } from '../middleware/errorHandler.js';
import { signStudentExamToken } from '../middleware/auth.js';
import { normalizeStudentId } from '../models/Counter.js';
import { buildAttemptReportDocx } from './resultsController.js';
import { getOrCreateExamSnapshot } from '../services/snapshotService.js';

// Shuffle array utility (Fisher-Yates)
function shuffleArray(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Student Login & Start / Resume Exam Attempt
export async function loginAndStartExam(req, res) {
  const { accessToken, studentId, password } = req.body;

  // 1. Find exam by accessToken
  const exam = await Exam.findOne({ accessToken });
  if (!exam) {
    throw new ApiError(404, 'Invalid exam link or access token');
  }

  // 2. Check exam status & time window
  if (exam.status !== 'open') {
    throw new ApiError(403, `This exam is currently ${exam.status}. Access is closed.`);
  }

  if (!exam.isWithinWindow()) {
    const now = new Date();
    if (exam.startAt && now < exam.startAt) {
      throw new ApiError(403, `This exam has not started yet. Starts at ${exam.startAt.toLocaleString()}`);
    }
    if (exam.endAt && now > exam.endAt) {
      throw new ApiError(403, `This exam window has closed. Ended at ${exam.endAt.toLocaleString()}`);
    }
  }

  // 3. Find student by studentId (exact match using normalized canonicalId)
  const canonicalId = normalizeStudentId(studentId);
  const student = await User.findOne({
    studentId: canonicalId,
    role: 'student',
  });
  if (!student) {
    throw new ApiError(401, 'Invalid Student ID or password');
  }

  if (!student.isActive) {
    throw new ApiError(403, 'Your student account is inactive. Please contact the Ustaz.');
  }

  // 4. Verify password
  const isMatch = await bcrypt.compare(password, student.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid Student ID or password');
  }

  // 5. Check allowedStudents list if populated
  if (exam.allowedStudents && exam.allowedStudents.length > 0) {
    const isAllowed = exam.allowedStudents.some(
      (id) => id.toString() === student._id.toString()
    );
    if (!isAllowed) {
      throw new ApiError(403, 'You are not assigned to take this exam.');
    }
  }

  // 6. Check existing attempt for this student + exam
  let attempt = await Attempt.findOne({
    examId: exam._id,
    studentId: student._id,
  });

  if (attempt) {
    if (attempt.status !== 'in_progress') {
      const token = signStudentExamToken(student._id, exam._id);
      return res.json({
        token,
        alreadySubmitted: true,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        message: 'You have already submitted this exam.',
      });
    }

    // Check if in_progress attempt has expired
    if (attempt.isExpired()) {
      // Auto-submit expired attempt
      attempt.status = 'auto_submitted';
      attempt.submittedAt = attempt.deadline;
      await gradeAttempt(attempt, exam._id);
      await attempt.save();

      const token = signStudentExamToken(student._id, exam._id);
      return res.json({
        token,
        alreadySubmitted: true,
        status: 'auto_submitted',
        submittedAt: attempt.submittedAt,
        message: 'Your exam time has expired and it was automatically submitted.',
      });
    }
  } else {
    // Create new attempt
    const questions = await Question.find({ examId: exam._id }).sort({ order: 1 });

    if (questions.length === 0) {
      throw new ApiError(400, 'This exam has no questions configured yet.');
    }

    let questionIds = questions.map((q) => q._id);
    if (exam.shuffleQuestions) {
      questionIds = shuffleArray(questionIds);
    }

    const optionOrderByQuestion = new Map();
    for (const q of questions) {
      if (q.options && q.options.length > 0) {
        let optionIds = q.options.map((o) => o.id);
        if (exam.shuffleOptions) {
          optionIds = shuffleArray(optionIds);
        }
        optionOrderByQuestion.set(q._id.toString(), optionIds);
      }
    }

    const now = new Date();
    const durationMs = exam.durationMinutes * 60 * 1000;
    const deadline = new Date(now.getTime() + durationMs);

    const snapshot = await getOrCreateExamSnapshot(exam._id);

    attempt = await Attempt.create({
      examId: exam._id,
      snapshotId: snapshot?._id || null,
      examTitle: snapshot?.title || exam.title,
      categoryName: snapshot?.categoryName || 'Uncategorized',
      passMark: snapshot?.passMark ?? exam.passMark ?? 50,
      totalMarks: snapshot?.totalMarks || 0,
      studentId: student._id,
      questionOrder: questionIds,
      optionOrderByQuestion,
      answers: new Map(),
      flaggedQuestions: [],
      startedAt: now,
      deadline,
      status: 'in_progress',
    });
  }

  // 7. Issue scoped student exam JWT token
  const token = signStudentExamToken(student._id, exam._id);

  res.json({
    token,
    attemptId: attempt._id,
    exam: {
      id: exam._id,
      title: exam.title,
      description: exam.description || '',
      subject: exam.subject,
      durationMinutes: exam.durationMinutes,
      passingMark: exam.passingMark,
      instructions: exam.instructions,
    },
    student: {
      id: student._id,
      studentId: student.studentId,
      fullName: student.fullName,
    },
  });
}

// Get Exam Questions & Current Saved Attempt State
export async function getActiveExam(req, res) {
  const { userId, examId } = req.user;

  const attempt = await Attempt.findOne({ examId, studentId: userId });
  if (!attempt) {
    throw new ApiError(404, 'No active exam attempt found');
  }

  const exam = await Exam.findById(examId).lean();
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  if (exam.status === 'closed') {
    throw new ApiError(403, 'This exam has been closed by the Ustaz.');
  }

  // Check expiration
  if (attempt.status === 'in_progress' && attempt.isExpired()) {
    attempt.status = 'auto_submitted';
    attempt.submittedAt = attempt.deadline;
    await gradeAttempt(attempt, examId);
    await attempt.save();

    return res.status(400).json({
      error: 'Time expired',
      status: 'auto_submitted',
      submittedAt: attempt.submittedAt,
    });
  }

  if (attempt.status !== 'in_progress') {
    return res.status(400).json({
      error: 'Exam attempt is already completed',
      status: attempt.status,
    });
  }

  // Fetch questions in preserved attempt order
  const questionsMap = new Map();
  const rawQuestions = await Question.find({ examId });
  for (const q of rawQuestions) {
    questionsMap.set(q._id.toString(), q);
  }

  const orderedQuestions = attempt.questionOrder
    .map((qId) => questionsMap.get(qId.toString()))
    .filter(Boolean)
    .map((q) => {
      const optionOrder = attempt.optionOrderByQuestion?.get
        ? attempt.optionOrderByQuestion.get(q._id.toString())
        : undefined;
      return q.toStudentJSON(optionOrder);
    });

  const remainingMs = attempt.remainingMs();
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

  const student = await User.findById(userId).select('fullName studentId').lean();

  res.json({
    exam: {
      id: exam._id,
      title: exam.title,
      description: exam.description || '',
      subject: exam.subject,
      durationMinutes: exam.durationMinutes,
      passingMark: exam.passingMark,
      instructions: exam.instructions,
      requireFullscreen: exam.requireFullscreen,
      preventTabSwitch: exam.preventTabSwitch,
      maxTabSwitches: exam.maxTabSwitches,
    },
    student: student
      ? {
          id: student._id,
          fullName: student.fullName,
          studentId: student.studentId,
        }
      : null,
    remainingSeconds,
    deadline: attempt.deadline,
    questions: orderedQuestions,
    answers: Object.fromEntries(attempt.answers || new Map()),
    flaggedQuestions: attempt.flaggedQuestions || [],
    tabSwitchCount: attempt.tabSwitchCount || 0,
  });
}

// Save Progress (Autosave endpoint)
export async function saveProgress(req, res) {
  const { userId, examId } = req.user;
  const { answers, flaggedQuestions, tabSwitchCount } = req.body;

  const now = new Date();

  const attempt = await Attempt.findOne({ examId, studentId: userId })
    .select('status deadline')
    .lean();

  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  if (attempt.status !== 'in_progress') {
    throw new ApiError(400, 'Cannot save progress on completed exam');
  }

  if (now > attempt.deadline) {
    await Attempt.updateOne(
      { _id: attempt._id, status: 'in_progress' },
      { $set: { status: 'auto_submitted', submittedAt: attempt.deadline } }
    );
    const fullAttempt = await Attempt.findById(attempt._id);
    if (fullAttempt) {
      await gradeAttempt(fullAttempt, examId);
      await fullAttempt.save();
    }

    return res.status(400).json({
      error: 'Time expired',
      status: 'auto_submitted',
    });
  }

  const updateFields = {};
  if (answers && typeof answers === 'object') {
    for (const [qId, val] of Object.entries(answers)) {
      updateFields[`answers.${qId}`] = val;
    }
  }
  if (Array.isArray(flaggedQuestions)) {
    updateFields.flaggedQuestions = flaggedQuestions;
  }
  if (typeof tabSwitchCount === 'number') {
    updateFields.tabSwitchCount = tabSwitchCount;
  }

  if (Object.keys(updateFields).length > 0) {
    await Attempt.updateOne(
      { _id: attempt._id, status: 'in_progress', deadline: { $gt: now } },
      { $set: updateFields }
    );
  }

  const remainingMs = Math.max(0, attempt.deadline.getTime() - Date.now());
  const remainingSeconds = Math.floor(remainingMs / 1000);
  res.json({ success: true, remainingSeconds });
}

// Submit Exam
export async function submitExam(req, res) {
  const { userId, examId } = req.user;
  const { answers } = req.body;

  const attempt = await Attempt.findOne({ examId, studentId: userId });
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  if (attempt.status !== 'in_progress') {
    return res.json({
      message: 'Exam already submitted',
      status: attempt.status,
      score: attempt.score,
    });
  }

  // Update final answers if provided
  if (answers && typeof answers === 'object') {
    for (const [qId, val] of Object.entries(answers)) {
      attempt.answers.set(qId, val);
    }
  }

  attempt.status = 'submitted';
  attempt.submittedAt = new Date();

  // Grade attempt
  const { score, totalMarks } = await gradeAttempt(attempt, examId);
  attempt.score = score;
  attempt.totalMarks = totalMarks;

  await attempt.save();

  const exam = await Exam.findById(examId).lean();

  res.json({
    success: true,
    status: attempt.status,
    submittedAt: attempt.submittedAt,
    resultsReleased: exam ? exam.resultsReleased : false,
    score: exam && exam.resultsReleased ? score : null,
    totalMarks: exam && exam.resultsReleased ? totalMarks : null,
  });
}

// Get Result
export async function getResult(req, res) {
  const { userId, examId } = req.user;

  const attempt = await Attempt.findOne({ examId, studentId: userId });
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  const exam = await Exam.findById(examId).lean();
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  if (!exam.resultsReleased) {
    return res.json({
      resultsReleased: false,
      examTitle: exam.title,
      examLanguage: exam.language || 'en',
      subject: exam.subject,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
      message: 'Your exam submission has been recorded. Results will be published by the Ustaz.',
    });
  }

  // Results released: send detailed breakdown
  const questions = await Question.find({ examId }).sort({ order: 1 }).lean();
  const studentAnswers = Object.fromEntries(attempt.answers || new Map());
  const manualGrades = Object.fromEntries(attempt.manualGrades || new Map());

  const detailedQuestions = questions.map((q) => {
    const studentAns = studentAnswers[q._id.toString()];
    const manual = manualGrades[q._id.toString()];
    const isShortAnswer = q.type === 'short_answer';
    const isGradedByTeacher = Boolean(manual && typeof manual.marks === 'number');
    const isCorrect = isShortAnswer ? null : checkAnswerCorrectness(q, studentAns);

    let earnedMarks = 0;
    if (manual && typeof manual.marks === 'number') {
      earnedMarks = manual.marks;
    } else if (isCorrect) {
      earnedMarks = q.marks;
    }

    return {
      _id: q._id,
      type: q.type,
      text: q.text,
      options: q.options,
      correctAnswer: isShortAnswer ? null : q.correctAnswer,
      explanation: q.explanation,
      marks: q.marks,
      earnedMarks,
      studentAnswer: studentAns,
      isCorrect,
      isGradedByTeacher,
      feedback: manual ? manual.feedback : '',
    };
  });

  const percentage = attempt.totalMarks > 0
    ? Math.round((attempt.score / attempt.totalMarks) * 100)
    : 0;

  const passThreshold = typeof exam.passMark === 'number' && !isNaN(exam.passMark) ? exam.passMark : 50;
  const passed = percentage >= passThreshold;

  res.json({
    resultsReleased: true,
    examTitle: exam.title,
    examLanguage: exam.language || 'en',
    subject: exam.subject,
    status: attempt.status,
    submittedAt: attempt.submittedAt,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    passMark: passThreshold,
    percentage,
    passed,
    questions: detailedQuestions,
  });
}

// Helper: Auto-grade attempt
async function gradeAttempt(attempt, examId) {
  const questions = await Question.find({ examId }).lean();
  const answers = Object.fromEntries(attempt.answers || new Map());
  const manualGrades = attempt.manualGrades instanceof Map
    ? Object.fromEntries(attempt.manualGrades)
    : attempt.manualGrades || {};

  let score = 0;
  let totalMarks = 0;
  let needsGrading = false;

  for (const q of questions) {
    totalMarks += q.marks || 1;
    const studentAns = answers[q._id.toString()];
    const manualGrade = manualGrades[q._id.toString()];

    if (q.type === 'short_answer') {
      if (manualGrade && typeof manualGrade.marks === 'number') {
        score += manualGrade.marks;
      } else {
        // Short answer questions require manual teacher correction
        needsGrading = true;
      }
    } else {
      // Choice (mcq_single, mcq_multi) and True/False are auto-graded by computer
      if (manualGrade && typeof manualGrade.marks === 'number') {
        score += manualGrade.marks;
      } else if (checkAnswerCorrectness(q, studentAns)) {
        score += q.marks || 1;
      }
    }
  }

  attempt.score = score;
  attempt.totalMarks = totalMarks;
  attempt.needsGrading = needsGrading;
  return { score, totalMarks, needsGrading };
}

// Helper: Check if student answer matches question correct answer
function checkAnswerCorrectness(q, studentAns) {
  if (studentAns === undefined || studentAns === null) return false;

  if (q.type === 'mcq_single' || q.type === 'true_false') {
    return String(studentAns).trim() === String(q.correctAnswer).trim();
  }

  if (q.type === 'mcq_multi') {
    if (!Array.isArray(studentAns) || !Array.isArray(q.correctAnswer)) return false;
    if (studentAns.length !== q.correctAnswer.length) return false;
    const sSet = new Set(studentAns.map(String));
    return q.correctAnswer.every((ans) => sSet.has(String(ans)));
  }

  if (q.type === 'short_answer') {
    // Short answer questions must be manually graded by the teacher
    return false;
  }

  return false;
}

export async function downloadStudentResultDocx(req, res) {
  const { userId, examId } = req.user;

  const attempt = await Attempt.findOne({ examId, studentId: userId });
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  const exam = await Exam.findById(examId).lean();
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  if (!exam.resultsReleased) {
    throw new ApiError(403, 'Results have not been released by the Ustaz yet.');
  }

  const targetLang = req.query.lang || exam.language || null;
  const { buffer, filename } = await buildAttemptReportDocx(attempt._id, targetLang);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}
