import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { Attempt } from '../models/Attempt.js';
import { User } from '../models/User.js';
import { ApiError } from '../middleware/errorHandler.js';
import { getOrCreateExamSnapshot } from '../services/snapshotService.js';

export async function listExams(req, res) {
  const filter = {};
  if (req.query.categoryId) {
    filter.categoryId = req.query.categoryId;
  }

  const [exams, totalStudentsCount] = await Promise.all([
    Exam.find(filter)
      .populate('categoryId', 'name description')
      .sort({ createdAt: -1 })
      .lean(),
    User.countDocuments({ role: 'student', isActive: true }),
  ]);

  const examIds = exams.map((e) => e._id);

  // Aggregation for Question counts and Total Marks
  const questionAgg = await Question.aggregate([
    { $match: { examId: { $in: examIds } } },
    {
      $group: {
        _id: '$examId',
        count: { $sum: 1 },
        totalMarks: {
          $sum: { $ifNull: ['$marks', { $ifNull: ['$points', 1] }] },
        },
      },
    },
  ]);

  const questionMap = Object.fromEntries(
    questionAgg.map((q) => [q._id.toString(), q])
  );

  // Aggregation for Attempts: submitted vs in-progress
  const attemptAgg = await Attempt.aggregate([
    { $match: { examId: { $in: examIds } } },
    {
      $group: {
        _id: '$examId',
        submittedCount: {
          $sum: {
            $cond: [
              { $in: ['$status', ['submitted', 'auto_submitted', 'force_submitted']] },
              1,
              0,
            ],
          },
        },
        inProgressCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0],
          },
        },
        totalAttemptCount: { $sum: 1 },
      },
    },
  ]);

  const attemptMap = Object.fromEntries(
    attemptAgg.map((a) => [a._id.toString(), a])
  );

  const enriched = exams.map((e) => {
    const qData = questionMap[e._id.toString()] || { count: 0, totalMarks: 0 };
    const aData = attemptMap[e._id.toString()] || {
      submittedCount: 0,
      inProgressCount: 0,
      totalAttemptCount: 0,
    };
    const eligibleCount =
      e.allowedStudents && e.allowedStudents.length > 0
        ? e.allowedStudents.length
        : totalStudentsCount;

    return {
      ...e,
      questionCount: qData.count,
      totalMarks: qData.totalMarks,
      submittedCount: aData.submittedCount,
      inProgressCount: aData.inProgressCount,
      attemptCount: aData.totalAttemptCount,
      eligibleCount,
    };
  });

  res.json({ exams: enriched });
}

export async function createExam(req, res) {
  const exam = await Exam.create(req.body);
  res.status(201).json({ exam });
}

export async function getExam(req, res) {
  const exam = await Exam.findById(req.params.id)
    .populate('categoryId', 'name description')
    .lean();
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  const questionCount = await Question.countDocuments({ examId: exam._id });
  const attemptCount = await Attempt.countDocuments({ examId: exam._id });

  res.json({ exam: { ...exam, questionCount, attemptCount } });
}

export async function updateExam(req, res) {
  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  Object.assign(exam, req.body);
  await exam.save();
  res.json({ exam });
}

export async function duplicateExam(req, res) {
  const original = await Exam.findById(req.params.id).lean();
  if (!original) {
    throw new ApiError(404, 'Exam not found');
  }

  const { _id, accessToken, createdAt, updatedAt, __v, ...examData } = original;
  const newExam = await Exam.create({
    ...examData,
    title: `${original.title} (Copy)`,
    status: 'draft',
    resultsReleased: false,
    allowedStudents: [],
  });

  // Duplicate questions
  const questions = await Question.find({ examId: original._id }).lean();
  if (questions.length > 0) {
    const newQuestions = questions.map(
      ({ _id, examId, createdAt, updatedAt, __v, ...q }) => ({
        ...q,
        examId: newExam._id,
      })
    );
    await Question.insertMany(newQuestions);
  }

  const questionCount = questions.length;
  res.status(201).json({ exam: { ...newExam.toObject(), questionCount, attemptCount: 0 } });
}

export async function updateStatus(req, res) {
  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  const { status } = req.body;
  const oldStatus = exam.status;
  exam.status = status;
  await exam.save();

  // If closing with force_submit, auto-submit all in-progress attempts
  if (status === 'closed' && exam.closeAction === 'force_submit') {
    await Attempt.updateMany(
      { examId: exam._id, status: 'in_progress' },
      {
        $set: {
          status: 'force_submitted',
          submittedAt: new Date(),
        },
      }
    );
  }

  res.json({
    exam,
    message: `Exam status changed from ${oldStatus} to ${status}`,
  });
}

export async function regenerateToken(req, res) {
  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  const newToken = exam.regenerateToken();
  await exam.save();

  res.json({ accessToken: newToken });
}

export async function releaseResults(req, res) {
  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  exam.resultsReleased = !exam.resultsReleased;
  await exam.save();

  res.json({
    resultsReleased: exam.resultsReleased,
    message: exam.resultsReleased ? 'Results released to students' : 'Results hidden from students',
  });
}

// Public route: get exam info by access token (no auth required)
export async function getExamByToken(req, res) {
  const exam = await Exam.findOne({ accessToken: req.params.token });
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  if (exam.status === 'closed') {
    throw new ApiError(404, 'This exam link is invalid or has been terminated by the Ustaz.');
  }

  res.json({
    exam: {
      _id: exam._id,
      title: exam.title,
      description: exam.description || '',
      instructions: exam.instructions || '',
      subject: exam.subject || '',
      durationMinutes: exam.durationMinutes,
      status: exam.status,
    },
  });
}

// Delete exam: removes exam definition & questions, but preserves all student attempts and results via snapshot
export async function deleteExam(req, res) {
  const { forceSubmit } = req.body || {};
  const exam = await Exam.findById(req.params.id);
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  // Check for in-progress attempts
  const inProgressAttempts = await Attempt.find({
    examId: exam._id,
    status: 'in_progress',
  });

  if (inProgressAttempts.length > 0 && !forceSubmit) {
    return res.status(400).json({
      error: 'IN_PROGRESS_ATTEMPTS',
      inProgressCount: inProgressAttempts.length,
      message: `${inProgressAttempts.length} student(s) are currently taking this exam. You must force-submit their attempts before deleting.`,
    });
  }

  // If forceSubmit requested, auto-submit all in-progress attempts
  if (inProgressAttempts.length > 0 && forceSubmit) {
    const now = new Date();
    for (const att of inProgressAttempts) {
      att.status = 'force_submitted';
      att.submittedAt = now;
      await att.save();
    }
  }

  // Ensure immutable snapshot exists before deleting exam & questions
  let snapshot = await getOrCreateExamSnapshot(exam._id);
  if (snapshot) {
    snapshot.deletedAt = new Date();
    if (req.user?._id) {
      snapshot.deletedBy = req.user._id;
    }
    await snapshot.save();
  }

  // Mark all attempts as belonging to a deleted exam and link snapshot details
  await Attempt.updateMany(
    { examId: exam._id },
    {
      $set: {
        examDeleted: true,
        deletedAt: new Date(),
        snapshotId: snapshot?._id || null,
        examTitle: snapshot?.title || exam.title,
        categoryName: snapshot?.categoryName || 'Uncategorized',
        passMark: snapshot?.passMark ?? exam.passMark ?? 50,
      },
    }
  );

  // Delete associated questions and the exam document
  await Question.deleteMany({ examId: exam._id });
  await Exam.findByIdAndDelete(exam._id);

  res.json({
    message: 'Exam, questions, and access link permanently deleted. Student results have been preserved.',
    preservedAttemptsCount: await Attempt.countDocuments({ snapshotId: snapshot?._id }),
  });
}

// Download exam as Word Document (.docx)
export async function downloadExam(req, res) {
  const exam = await Exam.findById(req.params.id).populate('categoryId', 'name').lean();
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  const questions = await Question.find({ examId: exam._id })
    .sort({ order: 1 })
    .lean();

  const lang = exam.language || 'en';
  const labels = {
    en: {
      instructions: 'Instructions: ',
      duration: 'Duration: ',
      mins: 'minutes',
      totalQuestions: 'Total Questions: ',
      category: 'Category: ',
      general: 'General',
      pts: 'pts',
      correctAnswer: '  ✓ (Correct Answer)',
      correctAnswerLabel: 'Correct Answer: ',
      sampleAnswer: 'Sample Answer: ',
      explanation: 'Explanation: ',
      trueText: 'True',
      falseText: 'False',
    },
    am: {
      instructions: 'መመሪያዎች፦ ',
      duration: 'የፈተና ጊዜ፦ ',
      mins: 'ደቂቃዎች',
      totalQuestions: 'ጠቅላላ ጥያቄዎች፦ ',
      category: 'ምድብ፦ ',
      general: 'አጠቃላይ',
      pts: 'ነጥቦች',
      correctAnswer: '  ✓ (ትክክለኛ መልስ)',
      correctAnswerLabel: 'ትክክለኛ መልስ፦ ',
      sampleAnswer: 'ምሳሌ መልስ፦ ',
      explanation: 'ማብራሪያ፦ ',
      trueText: 'እውነት',
      falseText: 'ሐሰት',
    },
    ar: {
      instructions: 'التعليمات: ',
      duration: 'مدة الاختبار: ',
      mins: 'دقائق',
      totalQuestions: 'إجمالي الأسئلة: ',
      category: 'الفئة: ',
      general: 'عام',
      pts: 'درجة',
      correctAnswer: '  ✓ (الإجابة الصحيحة)',
      correctAnswerLabel: 'الإجابة الصحيحة: ',
      sampleAnswer: 'نموذج الإجابة: ',
      explanation: 'الشرح والبيان: ',
      trueText: 'صحيح',
      falseText: 'خطأ',
    },
  }[lang] || {
    instructions: 'Instructions: ',
    duration: 'Duration: ',
    mins: 'minutes',
    totalQuestions: 'Total Questions: ',
    category: 'Category: ',
    general: 'General',
    pts: 'pts',
    correctAnswer: '  ✓ (Correct Answer)',
    correctAnswerLabel: 'Correct Answer: ',
    sampleAnswer: 'Sample Answer: ',
    explanation: 'Explanation: ',
    trueText: 'True',
    falseText: 'False',
  };

  const docChildren = [
    new Paragraph({
      text: exam.title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ];

  if (exam.description) {
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: labels.instructions, bold: true }),
          new TextRun({ text: exam.description }),
        ],
        spacing: { after: 200 },
      })
    );
  }

  docChildren.push(
    new Paragraph({
      children: [
        new TextRun({ text: labels.duration, bold: true }),
        new TextRun({ text: `${exam.durationMinutes} ${labels.mins}    ` }),
        new TextRun({ text: labels.totalQuestions, bold: true }),
        new TextRun({ text: `${questions.length}    ` }),
        new TextRun({ text: labels.category, bold: true }),
        new TextRun({ text: `${exam.categoryId?.name || labels.general}` }),
      ],
      spacing: { after: 300 },
    })
  );

  questions.forEach((q, idx) => {
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Q${idx + 1}. `, bold: true }),
          new TextRun({ text: `${q.text} `, bold: true }),
          new TextRun({ text: `(${q.points || q.marks || 1} ${labels.pts})`, italic: true }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    if (q.options && q.options.length > 0) {
      q.options.forEach((opt, oIdx) => {
        const letter = String.fromCharCode(65 + oIdx);
        const isCorrect = opt.isCorrect || q.correctAnswer === opt._id || q.correctAnswer === opt.text;
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `    ${letter}) ${opt.text} ` }),
              ...(isCorrect ? [new TextRun({ text: labels.correctAnswer, bold: true, color: '0D9488' })] : []),
            ],
            spacing: { after: 60 },
          })
        );
      });
    } else if (q.type === 'true_false') {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `    [  ] ${labels.trueText}       [  ] ${labels.falseText}  ` }),
            ...(q.correctAnswer ? [new TextRun({ text: `  (${labels.correctAnswerLabel}${q.correctAnswer})`, bold: true, color: '0D9488' })] : []),
          ],
          spacing: { after: 60 },
        })
      );
    } else if (q.type === 'short_answer' || q.type === 'essay') {
      if (q.sampleAnswer) {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: `    ${labels.sampleAnswer}`, bold: true }),
              new TextRun({ text: q.sampleAnswer }),
            ],
            spacing: { after: 60 },
          })
        );
      }
    }

    if (q.explanation) {
      docChildren.push(
        new Paragraph({
          children: [
            new TextRun({ text: `    ${labels.explanation}`, italic: true }),
            new TextRun({ text: q.explanation, italic: true }),
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

  const safeFilename = `${exam.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.send(buffer);
}

// Get in-progress students for an exam
export async function getInProgressStudents(req, res) {
  const { id } = req.params;
  const attempts = await Attempt.find({ examId: id, status: 'in_progress' })
    .populate('studentId', 'fullName studentId email')
    .sort({ startedAt: -1 })
    .lean();

  const students = attempts.map((att) => ({
    attemptId: att._id,
    studentObjectId: att.studentId?._id || att.studentId,
    fullName: att.studentId?.fullName || 'Student',
    studentCode: att.studentId?.studentId || '',
    startedAt: att.startedAt,
    deadline: att.deadline,
    extraTimeMinutes: att.extraTimeMinutes || 0,
  }));

  res.json({ students });
}

// Add extra time (e.g., +5 minutes) to exam duration & active student attempts
export async function addExtraTime(req, res) {
  const { id } = req.params;
  const minutes = Number(req.body.minutes) || 5;
  const studentIds = req.body.studentIds;

  const exam = await Exam.findById(id);
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  // 1. Increase exam default duration if all students
  if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
    exam.durationMinutes = (exam.durationMinutes || 0) + minutes;
    await exam.save();
  }

  // 2. Update active in-progress attempts for this exam
  const msToAdd = minutes * 60 * 1000;
  const filter = {
    examId: exam._id,
    status: 'in_progress',
  };
  if (Array.isArray(studentIds) && studentIds.length > 0) {
    filter.studentId = { $in: studentIds };
  }

  const updateResult = await Attempt.updateMany(filter, [
    {
      $set: {
        deadline: { $add: ['$deadline', msToAdd] },
        extraTimeMinutes: { $add: [{ $ifNull: ['$extraTimeMinutes', 0] }, minutes] },
      },
    },
  ]);

  const updatedCount = updateResult.modifiedCount || updateResult.nModified || 0;

  res.json({
    success: true,
    durationMinutes: exam.durationMinutes,
    updatedAttemptsCount: updatedCount,
    message: `Added +${minutes} minute(s) to ${exam.title} and ${updatedCount} active student attempt(s).`,
  });
}
