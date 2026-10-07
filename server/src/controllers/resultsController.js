import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { Exam } from '../models/Exam.js';
import { User } from '../models/User.js';
import { Attempt } from '../models/Attempt.js';
import { Question } from '../models/Question.js';
import { ExamSnapshot } from '../models/ExamSnapshot.js';
import { ApiError } from '../middleware/errorHandler.js';

// Summary: per-exam stats for a category (including preserved deleted exams)
export async function getResultsSummary(req, res) {
  const { categoryId } = req.query;

  const filter = {};
  if (categoryId) {
    filter.categoryId = categoryId;
  }

  const liveExams = await Exam.find(filter)
    .populate('categoryId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  const liveExamIdSet = new Set(liveExams.map((e) => e._id.toString()));

  // Find deleted exam snapshots matching category filter
  const snapshotFilter = { deletedAt: { $ne: null } };
  if (categoryId) {
    snapshotFilter.categoryId = categoryId;
  }
  const deletedSnapshots = await ExamSnapshot.find(snapshotFilter).sort({ deletedAt: -1 }).lean();

  const allExams = [
    ...liveExams.map((e) => ({ ...e, isDeleted: false })),
    ...deletedSnapshots.map((s) => ({
      _id: s._id,
      examId: s.examId,
      title: s.title,
      description: s.description,
      subject: s.subject,
      status: 'deleted',
      isDeleted: true,
      categoryId: s.categoryId,
      categoryName: s.categoryName,
      durationMinutes: s.durationMinutes,
      passMark: s.passMark,
      totalMarks: s.totalMarks,
    })),
  ];

  const eligibleCount = await User.countDocuments({
    role: 'student',
    isActive: true,
  });

  const liveExamIds = liveExams.map((e) => e._id);
  const snapshotIds = deletedSnapshots.map((s) => s._id);
  const deletedExamOriginalIds = deletedSnapshots.map((s) => s.examId).filter(Boolean);

  const allAttempts = await Attempt.find({
    $or: [
      { examId: { $in: [...liveExamIds, ...deletedExamOriginalIds] } },
      { snapshotId: { $in: snapshotIds } },
    ],
  }).lean();

  const attemptsByLiveExam = new Map();
  const attemptsBySnapshot = new Map();
  const attemptsByDeletedExam = new Map();

  for (const a of allAttempts) {
    if (a.snapshotId) {
      const key = a.snapshotId.toString();
      if (!attemptsBySnapshot.has(key)) attemptsBySnapshot.set(key, []);
      attemptsBySnapshot.get(key).push(a);
    } else if (a.examId) {
      const key = a.examId.toString();
      if (a.examDeleted) {
        if (!attemptsByDeletedExam.has(key)) attemptsByDeletedExam.set(key, []);
        attemptsByDeletedExam.get(key).push(a);
      } else {
        if (!attemptsByLiveExam.has(key)) attemptsByLiveExam.set(key, []);
        attemptsByLiveExam.get(key).push(a);
      }
    }
  }

  const summaries = allExams.map((exam) => {
    let attempts = [];
    if (exam.isDeleted) {
      const bySnap = attemptsBySnapshot.get(exam._id.toString()) || [];
      const byOrig = exam.examId ? attemptsByDeletedExam.get(exam.examId.toString()) || [] : [];
      const map = new Map();
      for (const a of [...bySnap, ...byOrig]) map.set(a._id.toString(), a);
      attempts = Array.from(map.values());
    } else {
      attempts = attemptsByLiveExam.get(exam._id.toString()) || [];
    }

    const submitted = attempts.filter((a) =>
      ['submitted', 'auto_submitted', 'force_submitted'].includes(a.status)
    );
    const inProgress = attempts.filter((a) => a.status === 'in_progress');

    const scores = submitted
      .filter((a) => a.score !== null && a.totalMarks !== null && a.totalMarks > 0)
      .map((a) => (a.score / a.totalMarks) * 100);

    const average = scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    const highest = scores.length > 0 ? Math.max(...scores) : 0;
    const lowest = scores.length > 0 ? Math.min(...scores) : 0;

    const passThreshold = typeof exam.passMark === 'number' && !isNaN(exam.passMark) ? exam.passMark : 50;
    const passRate =
      scores.length > 0
        ? (scores.filter((s) => s >= passThreshold).length / scores.length) * 100
        : null;

    const categoryName = exam.categoryName || (exam.categoryId?.name ? exam.categoryId.name : 'Uncategorized');

    const examEligibleCount =
      Array.isArray(exam.allowedStudents) && exam.allowedStudents.length > 0
        ? exam.allowedStudents.length
        : eligibleCount;

    return {
      examId: exam._id,
      originalExamId: exam.examId || exam._id,
      title: exam.title,
      status: exam.status,
      isDeleted: exam.isDeleted || false,
      categoryId: exam.categoryId?._id || exam.categoryId,
      categoryName,
      durationMinutes: exam.durationMinutes,
      passMark: exam.passMark,
      eligible: examEligibleCount,
      started: attempts.length,
      submitted: submitted.length,
      inProgress: inProgress.length,
      notStarted: exam.isDeleted ? 0 : Math.max(0, examEligibleCount - attempts.length),
      average: Math.round(average * 10) / 10,
      highest: Math.round(highest * 10) / 10,
      lowest: Math.round(lowest * 10) / 10,
      passRate: passRate !== null ? Math.round(passRate * 10) / 10 : null,
    };
  });

  res.json({ summaries });
}

// Per-exam: every student's result (including deleted exams)
export async function getExamResults(req, res) {
  const { examId } = req.params;
  const { page = 1, limit = 50, search } = req.query;

  let exam = await Exam.findById(examId).lean();
  let isDeleted = false;

  if (!exam) {
    const snapshot = await ExamSnapshot.findOne({
      $or: [{ _id: examId }, { examId }],
    }).lean();

    if (!snapshot) {
      throw new ApiError(404, 'Exam or result record not found');
    }

    exam = {
      _id: snapshot._id,
      examId: snapshot.examId,
      title: snapshot.title,
      status: 'deleted',
      passMark: snapshot.passMark,
      durationMinutes: snapshot.durationMinutes,
      isDeleted: true,
    };
    isDeleted = true;
  }

  const attemptFilter = isDeleted
    ? { $or: [{ snapshotId: exam._id }, { examId: exam.examId, examDeleted: true }] }
    : { examId: exam._id };

  const attempts = await Attempt.find(attemptFilter)
    .populate('studentId', 'studentId fullName isActive categoryIds email')
    .sort({ submittedAt: -1 })
    .lean();

  const passThreshold = typeof exam.passMark === 'number' && !isNaN(exam.passMark) ? exam.passMark : 50;

  let results = attempts.map((a) => {
    const student = a.studentId;
    const percentage =
      a.totalMarks && a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : null;

    const timeTaken =
      a.submittedAt && a.startedAt
        ? Math.round((new Date(a.submittedAt) - new Date(a.startedAt)) / 60000)
        : null;

    return {
      attemptId: a._id,
      studentId: student?.studentId || 'N/A',
      studentName: student?.fullName || 'Unknown',
      studentEmail: student?.email || '',
      studentDbId: student?._id,
      status: a.status,
      score: a.score,
      totalMarks: a.totalMarks,
      percentage,
      passed: percentage !== null ? percentage >= passThreshold : false,
      needsGrading: a.needsGrading || false,
      gradeVersion: a.gradeVersion || 1,
      resultEmail: a.resultEmail || { status: 'none' },
      timeTaken,
      submittedAt: a.submittedAt,
      startedAt: a.startedAt,
      tabSwitchCount: a.tabSwitchCount || 0,
      examDeleted: a.examDeleted || isDeleted,
    };
  });

  if (search) {
    const s = search.toLowerCase();
    results = results.filter(
      (r) =>
        r.studentName.toLowerCase().includes(s) ||
        r.studentId.toLowerCase().includes(s)
    );
  }

  // Include unstarted eligible students ONLY if live exam
  if (!isDeleted) {
    const studentFilter = { role: 'student', isActive: true };
    if (Array.isArray(exam.allowedStudents) && exam.allowedStudents.length > 0) {
      const allowedIds = exam.allowedStudents.map((id) =>
        typeof id === 'object' && id !== null ? id._id || id : String(id)
      );
      studentFilter._id = { $in: allowedIds };
    }

    const eligibleStudents = await User.find(studentFilter)
      .select('studentId fullName email')
      .lean();

    const attemptStudentIds = new Set(attempts.map((a) => a.studentId?._id?.toString()));

    const notStarted = eligibleStudents
      .filter((s) => !attemptStudentIds.has(s._id.toString()))
      .filter((s) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return s.fullName.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q);
      })
      .map((s) => ({
        attemptId: null,
        studentId: s.studentId,
        studentName: s.fullName,
        studentEmail: s.email || '',
        studentDbId: s._id,
        status: 'not_started',
        score: null,
        totalMarks: null,
        percentage: null,
        passed: null,
        timeTaken: null,
        submittedAt: null,
        startedAt: null,
        tabSwitchCount: 0,
        examDeleted: false,
      }));

    results = [...results, ...notStarted];
  }

  const total = results.length;
  const pageNum = Number(page) || 1;
  const limitNum = Number(limit) || 50;
  const paginated = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({
    exam: {
      _id: exam._id,
      title: exam.title,
      status: exam.status,
      isDeleted,
      passMark: exam.passMark,
      durationMinutes: exam.durationMinutes,
      language: exam.language || 'en',
    },
    results: paginated,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
}

// Per-student: all their exams and scores
export async function getStudentResults(req, res) {
  const { studentId } = req.params;

  const student = await User.findById(studentId).select('studentId fullName categoryIds').lean();
  if (!student) {
    throw new ApiError(404, 'Student not found');
  }

  // Get all attempts for this student
  const attempts = await Attempt.find({ studentId })
    .populate('examId', 'title status categoryId durationMinutes passMark')
    .sort({ startedAt: -1 })
    .lean();

  const results = attempts.map((a) => {
    const exam = a.examId;
    const percentage =
      a.totalMarks && a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : null;
    const timeTaken =
      a.submittedAt && a.startedAt
        ? Math.round((new Date(a.submittedAt) - new Date(a.startedAt)) / 60000)
        : null;

    return {
      attemptId: a._id,
      examId: exam?._id,
      examTitle: exam?.title || (a.examTitle ? `${a.examTitle} (deleted)` : 'Deleted Exam'),
      examDeleted: !exam || Boolean(a.examDeleted),
      examStatus: exam?.status || 'deleted',
      status: a.status,
      score: a.score,
      totalMarks: a.totalMarks,
      percentage,
      passed: exam?.passMark !== null && percentage !== null ? percentage >= exam.passMark : null,
      timeTaken,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      tabSwitchCount: a.tabSwitchCount || 0,
    };
  });

  res.json({
    student: {
      _id: student._id,
      studentId: student.studentId,
      fullName: student.fullName,
    },
    results,
  });
}

function buildExcelDocument(title, metadata = [], headers = [], rows = []) {
  const dateStr = new Date().toLocaleString();
  const metaHtml = [
    `<tr><td colspan="${headers.length}" style="font-family: Arial, sans-serif; font-size: 11px; color: #475569; padding: 3px 0;">Exported: ${dateStr}</td></tr>`,
    ...metadata.map(
      (m) =>
        `<tr><td colspan="${headers.length}" style="font-family: Arial, sans-serif; font-size: 11px; color: #475569; padding: 2px 0;"><strong>${m.label}:</strong> ${m.value}</td></tr>`
    ),
  ].join('');

  const headersHtml = headers
    .map(
      (h) =>
        `<th style="background-color: #0f766e; color: #ffffff; font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; padding: 10px; border: 1px solid #0d9488; text-align: left;">${h}</th>`
    )
    .join('');

  const rowsHtml = rows
    .map((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      const cells = r
        .map(
          (c) =>
            `<td style="font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 8px; border: 1px solid #cbd5e1;">${
              c !== null && c !== undefined ? String(c).replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''
            }</td>`
        )
        .join('');
      return `<tr style="background-color: ${bg};">${cells}</tr>`;
    })
    .join('');

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${String(title).replace(/[\\/?*:[\]]/g, '')}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Arial, sans-serif; }
      </style>
    </head>
    <body>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <td colspan="${headers.length}" style="font-family: Arial, sans-serif; font-size: 18px; font-weight: bold; color: #0f172a; background-color: #e2e8f0; padding: 14px; border: 1px solid #cbd5e1;">
            Medresa Exam Portal — ${title}
          </td>
        </tr>
        ${metaHtml}
        <tr><td colspan="${headers.length}" style="height: 10px;"></td></tr>
        <thead>
          <tr>${headersHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

// MS Excel export handler
export async function exportResultsCsv(req, res) {
  const { examId, studentId } = req.query;

  if (examId) {
    const exam = await Exam.findById(examId).lean();
    if (!exam) throw new ApiError(404, 'Exam not found');

    const attempts = await Attempt.find({ examId })
      .populate('studentId', 'studentId fullName')
      .sort({ submittedAt: -1 })
      .lean();

    const headers = [
      'Student ID',
      'Full Name',
      'Status',
      'Score',
      'Total Marks',
      'Percentage (%)',
      'Result',
      'Time Spent (min)',
      'Submitted At',
      'Tab Switches',
    ];
    const rows = [];

    for (const a of attempts) {
      const pct = a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : 0;
      const time =
        a.submittedAt && a.startedAt ? Math.round((new Date(a.submittedAt) - new Date(a.startedAt)) / 60000) : '';
      const isPass = exam.passMark ? a.score >= exam.passMark : pct >= 50;

      rows.push([
        a.studentId?.studentId || '',
        a.studentId?.fullName || '',
        a.status,
        a.score ?? 0,
        a.totalMarks ?? 0,
        `${pct}%`,
        isPass ? 'Passed' : 'Failed',
        time,
        a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '',
        a.tabSwitchCount || 0,
      ]);
    }

    const excelXml = buildExcelDocument(
      `Results for ${exam.title}`,
      [
        { label: 'Exam Title', value: exam.title },
        { label: 'Passing Mark', value: exam.passMark ? `${exam.passMark} pts` : 'N/A' },
        { label: 'Total Submissions', value: attempts.length },
      ],
      headers,
      rows
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${exam.title}-results.xlsx"`);
    return res.send(excelXml);
  }

  if (studentId) {
    const student = await User.findById(studentId).select('studentId fullName').lean();
    if (!student) throw new ApiError(404, 'Student not found');

    const attempts = await Attempt.find({ studentId })
      .populate('examId', 'title passMark')
      .sort({ startedAt: -1 })
      .lean();

    const headers = ['Exam Title', 'Status', 'Score', 'Total Marks', 'Percentage (%)', 'Result', 'Time Spent (min)', 'Submitted At'];
    const rows = [];

    for (const a of attempts) {
      const pct = a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : 0;
      const time =
        a.submittedAt && a.startedAt ? Math.round((new Date(a.submittedAt) - new Date(a.startedAt)) / 60000) : '';
      const isPass = a.examId?.passMark ? a.score >= a.examId.passMark : pct >= 50;

      rows.push([
        a.examId?.title || '',
        a.status,
        a.score ?? 0,
        a.totalMarks ?? 0,
        `${pct}%`,
        isPass ? 'Passed' : 'Failed',
        time,
        a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '',
      ]);
    }

    const excelXml = buildExcelDocument(
      `Student Results — ${student.fullName}`,
      [
        { label: 'Student ID', value: student.studentId },
        { label: 'Full Name', value: student.fullName },
        { label: 'Total Exams Taken', value: attempts.length },
      ],
      headers,
      rows
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${student.studentId}-results.xlsx"`);
    return res.send(excelXml);
  }

  // If neither examId nor studentId is specified, export all exam results
  const attempts = await Attempt.find({})
    .populate('studentId', 'studentId fullName')
    .populate('examId', 'title passMark')
    .sort({ submittedAt: -1, createdAt: -1 })
    .lean();

  const headers = [
    'Student ID',
    'Full Name',
    'Exam Title',
    'Status',
    'Score',
    'Total Marks',
    'Percentage (%)',
    'Result',
    'Time Spent (min)',
    'Submitted At',
    'Tab Switches',
  ];
  const rows = [];

  for (const a of attempts) {
    const pct = a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : 0;
    const time =
      a.submittedAt && a.startedAt ? Math.round((new Date(a.submittedAt) - new Date(a.startedAt)) / 60000) : '';
    const isPass = a.examId?.passMark ? a.score >= a.examId.passMark : pct >= 50;

    rows.push([
      a.studentId?.studentId || '',
      a.studentId?.fullName || '',
      a.examId?.title || 'Unknown Exam',
      a.status,
      a.score ?? 0,
      a.totalMarks ?? 0,
      `${pct}%`,
      isPass ? 'Passed' : 'Failed',
      time,
      a.submittedAt ? new Date(a.submittedAt).toLocaleString() : '',
      a.tabSwitchCount || 0,
    ]);
  }

  const excelXml = buildExcelDocument(
    'All Exam Results',
    [
      { label: 'Export Scope', value: 'All Exams & Students' },
      { label: 'Total Records', value: attempts.length },
    ],
    headers,
    rows
  );

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="all-exam-results.xlsx"');
  return res.send(excelXml);
}

// Get detailed attempt for grading
export async function getAttemptDetail(req, res) {
  const { attemptId } = req.params;

  const attempt = await Attempt.findById(attemptId)
    .populate('studentId', 'studentId fullName email')
    .populate('examId', 'title passMark durationMinutes')
    .lean();

  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  let questions = [];
  let examInfo = null;
  let isDeleted = attempt.examDeleted || !attempt.examId;

  if (attempt.examId && !attempt.examDeleted) {
    questions = await Question.find({ examId: attempt.examId._id }).sort({ order: 1 }).lean();
    examInfo = {
      _id: attempt.examId._id,
      title: attempt.examId.title,
      passMark: attempt.examId.passMark,
      durationMinutes: attempt.examId.durationMinutes,
      isDeleted: false,
    };
  } else {
    // Read from snapshot
    const snapshot = await ExamSnapshot.findOne({
      $or: [{ _id: attempt.snapshotId }, { examId: attempt.examId?._id || attempt.examId }],
    }).lean();

    questions = snapshot?.questions || [];
    examInfo = {
      _id: snapshot?._id || attempt.snapshotId,
      title: attempt.examTitle || snapshot?.title || 'Deleted Exam',
      passMark: attempt.passMark ?? snapshot?.passMark ?? 50,
      durationMinutes: snapshot?.durationMinutes || 30,
      isDeleted: true,
    };
  }

  const answers = attempt.answers instanceof Map
    ? Object.fromEntries(attempt.answers)
    : attempt.answers || {};
  const manualGrades = attempt.manualGrades instanceof Map
    ? Object.fromEntries(attempt.manualGrades)
    : attempt.manualGrades || {};

  const percentage = attempt.totalMarks > 0
    ? Math.round((attempt.score / attempt.totalMarks) * 100)
    : null;

  const passThreshold = typeof examInfo?.passMark === 'number' && !isNaN(examInfo.passMark)
    ? examInfo.passMark
    : 50;

  const passed = percentage !== null ? percentage >= passThreshold : false;

  const detailedQuestions = questions.map((q) => {
    const qIdStr = (q._id || q.id).toString();
    const studentAns = answers[qIdStr];
    const manual = manualGrades[qIdStr];
    const isCorrect = q.type !== 'short_answer' ? checkAnswerCorrectness(q, studentAns) : false;

    return {
      _id: q._id || q.id,
      type: q.type,
      text: q.text,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      marks: q.marks,
      studentAnswer: studentAns !== undefined ? studentAns : null,
      isCorrect,
      manualGrade: manual || null,
    };
  });

  res.json({
    attempt: {
      _id: attempt._id,
      status: attempt.status,
      score: attempt.score,
      totalMarks: attempt.totalMarks,
      percentage,
      passed,
      needsGrading: attempt.needsGrading || false,
      gradeVersion: attempt.gradeVersion || 1,
      resultEmail: attempt.resultEmail || { status: 'none' },
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      tabSwitchCount: attempt.tabSwitchCount,
      student: attempt.studentId,
      exam: examInfo,
    },
    questions: detailedQuestions,
  });
}

// Manual grading for a question in an attempt
export async function gradeQuestion(req, res) {
  const { attemptId, questionId } = req.params;
  const { marks, feedback } = req.body;

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  if (!attempt.manualGrades) {
    attempt.manualGrades = new Map();
  }
  attempt.manualGrades.set(questionId, { marks: Number(marks), feedback: feedback || '' });

  // Increment gradeVersion whenever teacher saves a grade
  attempt.gradeVersion = (attempt.gradeVersion || 1) + 1;

  // Load questions from live DB or ExamSnapshot fallback
  let questions = await Question.find({ examId: attempt.examId }).lean();
  if (questions.length === 0 && attempt.snapshotId) {
    const snapshot = await ExamSnapshot.findById(attempt.snapshotId).lean();
    if (snapshot) {
      questions = snapshot.questions || [];
    }
  }

  const answers = attempt.answers instanceof Map
    ? Object.fromEntries(attempt.answers)
    : attempt.answers || {};
  const grades = attempt.manualGrades instanceof Map
    ? Object.fromEntries(attempt.manualGrades)
    : attempt.manualGrades || {};

  let score = 0;
  let totalMarks = 0;
  let needsGrading = false;

  for (const q of questions) {
    const qIdStr = (q._id || q.id).toString();
    totalMarks += q.marks || 1;
    const manual = grades[qIdStr];
    if (q.type === 'short_answer') {
      if (manual && typeof manual.marks === 'number') {
        score += manual.marks;
      } else {
        needsGrading = true;
      }
    } else {
      if (manual && typeof manual.marks === 'number') {
        score += manual.marks;
      } else {
        const studentAns = answers[qIdStr];
        if (checkAnswerCorrectness(q, studentAns)) {
          score += q.marks || 1;
        }
      }
    }
  }

  attempt.score = score;
  attempt.totalMarks = totalMarks;
  attempt.needsGrading = needsGrading;
  await attempt.save();

  res.json({ success: true, score, totalMarks, needsGrading, gradeVersion: attempt.gradeVersion });
}

// Reset attempt (allow retake)
export async function resetAttempt(req, res) {
  const { attemptId } = req.params;

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  if (attempt.examDeleted) {
    throw new ApiError(400, 'Cannot allow retake for a deleted exam.');
  }

  await Attempt.findByIdAndDelete(attemptId);

  res.json({ message: 'Attempt reset. Student can now retake the exam.' });
}

// Explicit Dangerous Action: Delete all results for an exam from Results page ONLY
export async function deleteExamResults(req, res) {
  const { examId } = req.params;
  const { confirmationText } = req.body || {};

  if (confirmationText !== 'DELETE RESULTS') {
    throw new ApiError(400, 'Invalid confirmation text. You must type "DELETE RESULTS" to confirm.');
  }

  const result = await Attempt.deleteMany({
    $or: [{ examId }, { snapshotId: examId }],
  });

  res.json({
    message: `Successfully deleted ${result.deletedCount} student result(s).`,
    deletedCount: result.deletedCount,
  });
}

// Delete selected student attempt results
export async function deleteSelectedAttempts(req, res) {
  const { attemptIds = [] } = req.body || {};

  if (!Array.isArray(attemptIds) || attemptIds.length === 0) {
    throw new ApiError(400, 'No attempt IDs specified for deletion.');
  }

  const result = await Attempt.deleteMany({ _id: { $in: attemptIds } });

  res.json({
    message: `Successfully deleted ${result.deletedCount} selected student result(s).`,
    deletedCount: result.deletedCount,
  });
}

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

export async function buildAttemptReportDocx(attemptId, forcedLang = null) {
  const attempt = await Attempt.findById(attemptId)
    .populate('studentId', 'studentId fullName')
    .populate('examId', 'title durationMinutes passMark categoryId language')
    .lean();

  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  let exam = attempt.examId;
  if ((!exam || typeof exam !== 'object' || !exam.language) && attempt.examId) {
    const rawExam = await Exam.findById(attempt.examId).select('title durationMinutes passMark categoryId language').lean();
    if (rawExam) {
      exam = rawExam;
    }
  }

  let examLanguage = (typeof exam === 'object' && exam?.language ? exam.language : null) || forcedLang || attempt.language || 'en';

  if ((!examLanguage || examLanguage === 'en') && attempt.snapshotId) {
    const snap = await ExamSnapshot.findById(attempt.snapshotId).select('language').lean();
    if (snap && snap.language) {
      examLanguage = snap.language;
    }
  }

  const lang = (examLanguage || 'en').slice(0, 2);

  const labels = {
    en: {
      reportHeader: 'MEDRESA EXAM PORTAL — OFFICIAL STUDENT EXAM REPORT PAPER',
      studentName: 'Student Name: ',
      studentId: 'Student ID: ',
      examTitle: 'Exam Title: ',
      submittedDate: 'Submitted Date: ',
      timeSpent: 'Time Spent: ',
      tabSwitches: 'Tab Switches: ',
      scoreSummary: 'SCORE SUMMARY: ',
      marksLabel: 'Marks',
      resultLabel: 'RESULT: ',
      passed: 'PASSED',
      failed: 'FAILED',
      needsGrading: 'NEEDS USTAZ GRADING',
      passMarkLabel: 'Pass Mark: ',
      detailedBreakdown: 'DETAILED QUESTION RESULTS & CORRECTIONS',
      status: '    Status: ',
      statusCorrect: '✔ CORRECT',
      statusIncorrect: '✖ INCORRECT',
      statusGraded: '✏ USTAZ GRADED',
      statusPending: '⏳ PENDING USTAZ GRADING',
      studentAnswer: '    Student Answer: ',
      correctAnswer: '    Correct Answer: ',
      mistaken: '(✖ Mistaken)',
      correctChoice: '(✔ Correct Choice)',
      ustazFeedback: '    Ustaz Feedback: ',
      explanation: '    Explanation: ',
      noAnswer: '[No Answer Provided]',
      mins: 'mins',
    },
    am: {
      reportHeader: 'የመድረሳ ፈተና ፖርታል — ይፋዊ የተማሪ ፈተና ውጤት ሪፖርት',
      studentName: 'የተማሪ ስም፦ ',
      studentId: 'የተማሪ መታወቂያ፦ ',
      examTitle: 'የፈተናው ርዕስ፦ ',
      submittedDate: 'የተስረከበበት ቀን፦ ',
      timeSpent: 'የወሰደው ጊዜ፦ ',
      tabSwitches: 'የታብ ቅያሬዎች፦ ',
      scoreSummary: 'የውጤት ማጠቃለያ፦ ',
      marksLabel: 'ነጥቦች',
      resultLabel: 'ውጤት፦ ',
      passed: 'አልፏል',
      failed: 'ወድቋል',
      needsGrading: 'የኡስታዝ እርማት ያስፈልገዋል',
      passMarkLabel: 'ማለፊያ ነጥብ፦ ',
      detailedBreakdown: 'ዝርዝር የጥያቄዎች ውጤት እና እርማት',
      status: '    ሁኔታ፦ ',
      statusCorrect: '✔ ትክክል',
      statusIncorrect: '✖ ስህተት',
      statusGraded: '✏ በኡስታዝ የታረመ',
      statusPending: '⏳ የኡስታዝ እርማት በመጠባበቅ ላይ',
      studentAnswer: '    የተማሪው መልስ፦ ',
      correctAnswer: '    ትክክለኛ መልስ፦ ',
      mistaken: '(✖ የተሳሳተ)',
      correctChoice: '(✔ ትክክለኛ መረጣ)',
      ustazFeedback: '    የኡስታዝ አስተያየት፦ ',
      explanation: '    ማብራሪያ፦ ',
      noAnswer: '[ምንም መልስ አልተሰጠም]',
      mins: 'ደቂቃዎች',
    },
    ar: {
      reportHeader: 'بوابة امتحانات المدرسة — تقرير نتيجة الطالب الرسمي',
      studentName: 'اسم الطالب: ',
      studentId: 'رقم الطالب: ',
      examTitle: 'عنوان الاختبار: ',
      submittedDate: 'تاريخ التسليم: ',
      timeSpent: 'الوقت المستغرق: ',
      tabSwitches: 'عدد تنقلات الشاشة: ',
      scoreSummary: 'ملخص النتيجة: ',
      marksLabel: 'درجات',
      resultLabel: 'النتيجة: ',
      passed: 'ناجح',
      failed: 'راسب',
      needsGrading: 'في انتظار تصحيح الأستاذ',
      passMarkLabel: 'درجة النجاح: ',
      detailedBreakdown: 'تفاصيل الأسئلة والتصحيح',
      status: '    الحالة: ',
      statusCorrect: '✔ إجابة صحيحة',
      statusIncorrect: '✖ إجابة خاطئة',
      statusGraded: '✏ تم تصحيحه بواسطة الأستاذ',
      statusPending: '⏳ قيد تصحيح الأستاذ',
      studentAnswer: '    إجابة الطالب: ',
      correctAnswer: '    الإجابة الصحيحة: ',
      mistaken: '(✖ إجابة خاطئة)',
      correctChoice: '(✔ الخيار الصحيح)',
      ustazFeedback: '    ملاحظات الأستاذ: ',
      explanation: '    الشرح والبيان: ',
      noAnswer: '[لم يتم تقديم إجابة]',
      mins: 'دقائق',
    },
  }[lang] || {
    reportHeader: 'MEDRESA EXAM PORTAL — OFFICIAL STUDENT EXAM REPORT PAPER',
    studentName: 'Student Name: ',
    studentId: 'Student ID: ',
    examTitle: 'Exam Title: ',
    submittedDate: 'Submitted Date: ',
    timeSpent: 'Time Spent: ',
    tabSwitches: 'Tab Switches: ',
    scoreSummary: 'SCORE SUMMARY: ',
    marksLabel: 'Marks',
    resultLabel: 'RESULT: ',
    passed: 'PASSED',
    failed: 'FAILED',
    needsGrading: 'NEEDS USTAZ GRADING',
    passMarkLabel: 'Pass Mark: ',
    detailedBreakdown: 'DETAILED QUESTION RESULTS & CORRECTIONS',
    status: '    Status: ',
    statusCorrect: '✔ CORRECT',
    statusIncorrect: '✖ INCORRECT',
    statusGraded: '✏ USTAZ GRADED',
    statusPending: '⏳ PENDING USTAZ GRADING',
    studentAnswer: '    Student Answer: ',
    correctAnswer: '    Correct Answer: ',
    mistaken: '(✖ Mistaken)',
    correctChoice: '(✔ Correct Choice)',
    ustazFeedback: '    Ustaz Feedback: ',
    explanation: '    Explanation: ',
    noAnswer: '[No Answer Provided]',
    mins: 'mins',
  };

  const questions = await Question.find({ examId: exam._id || attempt.examId })
    .sort({ order: 1 })
    .lean();

  const answers = attempt.answers instanceof Map
    ? Object.fromEntries(attempt.answers)
    : attempt.answers || {};
  const manualGrades = attempt.manualGrades instanceof Map
    ? Object.fromEntries(attempt.manualGrades)
    : attempt.manualGrades || {};

  const score = typeof attempt.score === 'number' ? attempt.score : 0;
  const totalMarks = typeof attempt.totalMarks === 'number' ? attempt.totalMarks : 0;
  const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
  const passThreshold = typeof exam.passMark === 'number' ? exam.passMark : 50;
  const passed = percentage >= passThreshold;

  const student = attempt.studentId && typeof attempt.studentId === 'object' ? attempt.studentId : {};
  const studentName = student.fullName || 'Student';
  const studentIdCode = student.studentId || 'N/A';
  const examTitle = exam.title || 'Exam';
  const submittedDate = attempt.submittedAt
    ? new Date(attempt.submittedAt).toLocaleString()
    : 'In Progress';
  const timeSpent = attempt.submittedAt && attempt.startedAt
    ? `${Math.round((new Date(attempt.submittedAt) - new Date(attempt.startedAt)) / 60000)} ${labels.mins}`
    : 'N/A';

  const docChildren = [
    // Header Title
    new Paragraph({
      text: labels.reportHeader,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),

    // Student & Exam Metadata Summary Block
    new Paragraph({
      children: [
        new TextRun({ text: labels.studentName, bold: true }),
        new TextRun({ text: `${studentName}    ` }),
        new TextRun({ text: labels.studentId, bold: true }),
        new TextRun({ text: `${studentIdCode}    ` }),
        new TextRun({ text: labels.examTitle, bold: true }),
        new TextRun({ text: `${examTitle}` }),
      ],
      spacing: { after: 120 },
    }),

    new Paragraph({
      children: [
        new TextRun({ text: labels.submittedDate, bold: true }),
        new TextRun({ text: `${submittedDate}    ` }),
        new TextRun({ text: labels.timeSpent, bold: true }),
        new TextRun({ text: `${timeSpent}    ` }),
        new TextRun({ text: labels.tabSwitches, bold: true }),
        new TextRun({ text: `${attempt.tabSwitchCount || 0}` }),
      ],
      spacing: { after: 200 },
    }),

    // Score & Result Box
    new Paragraph({
      children: [
        new TextRun({ text: labels.scoreSummary, bold: true, size: 24 }),
        new TextRun({ text: `${score} / ${totalMarks} ${labels.marksLabel} (${percentage}%)    `, bold: true, size: 24 }),
        new TextRun({ text: labels.resultLabel, bold: true, size: 24 }),
        new TextRun({
          text: attempt.needsGrading ? labels.needsGrading : passed ? labels.passed : labels.failed,
          bold: true,
          size: 24,
          color: attempt.needsGrading ? 'D97706' : passed ? '059669' : 'DC2626',
        }),
        new TextRun({ text: ` (${labels.passMarkLabel}${passThreshold}%)`, italic: true, size: 20, color: '64748B' }),
      ],
      spacing: { after: 300 },
    }),

    // Detailed Section Heading
    new Paragraph({
      text: labels.detailedBreakdown,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 200 },
    }),
  ];

  // Render Question Details
  questions.forEach((q, idx) => {
    const studentAnsRaw = answers[q._id.toString()];
    const manual = manualGrades[q._id.toString()];
    const isCorrect = q.type !== 'short_answer' ? checkAnswerCorrectness(q, studentAnsRaw) : false;

    // Build Student Answer Text & Correct Answer Text
    let studentAnsText = labels.noAnswer;
    let correctAnsText = '';

    if (q.type === 'mcq_single') {
      if (q.options && q.options.length > 0) {
        const sOpt = q.options.find(
          (o, oIdx) =>
            String(o._id || o.id) === String(studentAnsRaw) ||
            String(o.text).trim() === String(studentAnsRaw).trim() ||
            String.fromCharCode(65 + oIdx) === String(studentAnsRaw).toUpperCase()
        );
        if (sOpt) {
          const sIdx = q.options.indexOf(sOpt);
          const letter = String.fromCharCode(65 + (sIdx >= 0 ? sIdx : 0));
          studentAnsText = `${letter}) ${sOpt.text}`;
        } else if (studentAnsRaw) {
          studentAnsText = String(studentAnsRaw);
        }

        const cOpt = q.options.find(
          (o, oIdx) =>
            String(o._id || o.id) === String(q.correctAnswer) ||
            String(o.text).trim() === String(q.correctAnswer).trim() ||
            String.fromCharCode(65 + oIdx) === String(q.correctAnswer).toUpperCase()
        );
        if (cOpt) {
          const cIdx = q.options.indexOf(cOpt);
          const letter = String.fromCharCode(65 + (cIdx >= 0 ? cIdx : 0));
          correctAnsText = `${letter}) ${cOpt.text}`;
        } else if (q.correctAnswer) {
          correctAnsText = String(q.correctAnswer);
        }
      }
    } else if (q.type === 'mcq_multi') {
      const selectedArr = Array.isArray(studentAnsRaw) ? studentAnsRaw : [];
      if (selectedArr.length > 0 && q.options) {
        const sTexts = selectedArr.map((val) => {
          const opt = q.options.find(
            (o) => String(o._id || o.id) === String(val) || String(o.text).trim() === String(val).trim()
          );
          if (opt) {
            const oIdx = q.options.indexOf(opt);
            return `${String.fromCharCode(65 + oIdx)}) ${opt.text}`;
          }
          return String(val);
        });
        studentAnsText = sTexts.join(', ');
      }

      const correctArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
      if (correctArr.length > 0 && q.options) {
        const cTexts = correctArr.map((val) => {
          const opt = q.options.find(
            (o) => String(o._id || o.id) === String(val) || String(o.text).trim() === String(val).trim()
          );
          if (opt) {
            const oIdx = q.options.indexOf(opt);
            return `${String.fromCharCode(65 + oIdx)}) ${opt.text}`;
          }
          return String(val);
        });
        correctAnsText = cTexts.join(', ');
      }
    } else if (q.type === 'true_false') {
      if (studentAnsRaw !== undefined && studentAnsRaw !== null && studentAnsRaw !== '') {
        studentAnsText = String(studentAnsRaw);
      }
      correctAnsText = String(q.correctAnswer || '');
    } else if (q.type === 'short_answer') {
      if (studentAnsRaw) {
        studentAnsText = String(studentAnsRaw);
      }
    }

    // Question Prompt
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Q${idx + 1}. `, bold: true, size: 24 }),
          new TextRun({ text: `${q.text} `, bold: true, size: 24 }),
          new TextRun({ text: `(${q.marks || 1} ${labels.marksLabel})`, italic: true, size: 20, color: '64748B' }),
        ],
        spacing: { before: 200, after: 80 },
      })
    );

    // Status Line
    let statusRuns = [];
    if (q.type === 'short_answer') {
      if (manual && typeof manual.marks === 'number') {
        statusRuns = [
          new TextRun({ text: labels.status, bold: true }),
          new TextRun({
            text: `${labels.statusGraded} (${manual.marks} / ${q.marks || 1} ${labels.marksLabel})`,
            bold: true,
            color: '0F766E',
          }),
        ];
      } else {
        statusRuns = [
          new TextRun({ text: labels.status, bold: true }),
          new TextRun({
            text: `${labels.statusPending} (Max ${q.marks || 1} ${labels.marksLabel})`,
            bold: true,
            color: 'D97706',
          }),
        ];
      }
    } else if (isCorrect) {
      statusRuns = [
        new TextRun({ text: labels.status, bold: true }),
        new TextRun({
          text: `${labels.statusCorrect} (+${q.marks || 1} / ${q.marks || 1} ${labels.marksLabel})`,
          bold: true,
          color: '059669',
        }),
      ];
    } else {
      statusRuns = [
        new TextRun({ text: labels.status, bold: true }),
        new TextRun({
          text: `${labels.statusIncorrect} (0 / ${q.marks || 1} ${labels.marksLabel})`,
          bold: true,
          color: 'DC2626',
        }),
      ];
    }

    docChildren.push(new Paragraph({ children: statusRuns, spacing: { after: 60 } }));

    // Answer Lines
    if (q.type !== 'short_answer' && !isCorrect) {
      // Mistaken question: Show Student Answer (Red ✖) AND Correct Choice (Green ✔)
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: labels.studentAnswer, bold: true }),
            new TextRun({ text: `${studentAnsText} `, color: 'DC2626' }),
            new TextRun({ text: `${labels.mistaken}`, bold: true, color: 'DC2626' }),
          ],
          spacing: { after: 40 },
        })
      );

      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: labels.correctAnswer, bold: true }),
            new TextRun({ text: `${correctAnsText} `, color: '059669', bold: true }),
            new TextRun({ text: `${labels.correctChoice}`, bold: true, color: '059669' }),
          ],
          spacing: { after: 80 },
        })
      );
    } else {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: labels.studentAnswer, bold: true }),
            new TextRun({
              text: studentAnsText,
              color: isCorrect ? '059669' : '1E293B',
            }),
          ],
          spacing: { after: 60 },
        })
      );
    }

    // Teacher Feedback (if present)
    if (manual && manual.feedback) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: labels.ustazFeedback, bold: true, color: '2563EB' }),
            new TextRun({ text: `"${manual.feedback}"`, italic: true, color: '1E40AF' }),
          ],
          spacing: { after: 60 },
        })
      );
    }

    // Explanation (if present)
    if (q.explanation) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: labels.explanation, bold: true, color: '4B5563' }),
            new TextRun({ text: q.explanation, italic: true, color: '4B5563' }),
          ],
          spacing: { after: 100 },
        })
      );
    }
  });

  const doc = new Document({
    sections: [{ properties: {}, children: docChildren }],
  });

  const buffer = await Packer.toBuffer(doc);
  const safeStudentId = (student.studentId || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
  const safeExamTitle = (exam.title || 'Exam').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Report_${safeStudentId}_${safeExamTitle}.docx`;

  return { buffer, filename };
}

export async function downloadAttemptDocx(req, res) {
  const { attemptId } = req.params;
  const requestedLang = req.query.lang || req.query.language || null;
  const { buffer, filename } = await buildAttemptReportDocx(attemptId, requestedLang);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

export async function allowRetakeAttempt(req, res) {
  const { attemptId } = req.params;
  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  attempt.retakeAllowed = true;
  await attempt.save();

  res.json({ success: true, message: 'Retake allowed for student', attempt });
}
