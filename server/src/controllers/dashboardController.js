import { User } from '../models/User.js';
import { Exam } from '../models/Exam.js';
import { Attempt } from '../models/Attempt.js';
import { Category } from '../models/Category.js';

export async function getAdminDashboard(req, res) {
  // Calculate date 7 days ago
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // 1. Overview counts
  const [
    totalStudents,
    activeStudents,
    totalExams,
    draftExams,
    openExamsCount,
    submissionsThisWeek,
  ] = await Promise.all([
    User.countDocuments({ role: 'student' }),
    User.countDocuments({ role: 'student', isActive: true }),
    Exam.countDocuments(),
    Exam.countDocuments({ status: 'draft' }),
    Exam.countDocuments({ status: 'open' }),
    Attempt.countDocuments({
      status: { $in: ['submitted', 'auto_submitted', 'force_submitted'] },
      submittedAt: { $gte: sevenDaysAgo },
    }),
  ]);

  // 2. Currently open / live exams
  const openExams = await Exam.find({ status: 'open' })
    .populate('categoryId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  // Single aggregation for all open exam attempt stats (replaces N+1 loop)
  const openExamIds = openExams.map((e) => e._id);
  const attemptAgg = openExamIds.length > 0
    ? await Attempt.aggregate([
        { $match: { examId: { $in: openExamIds } } },
        {
          $group: {
            _id: '$examId',
            started: { $sum: 1 },
            submitted: {
              $sum: {
                $cond: [
                  { $in: ['$status', ['submitted', 'auto_submitted', 'force_submitted']] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
    : [];

  const attemptMap = Object.fromEntries(
    (attemptAgg || []).map((a) => [a._id.toString(), a])
  );

  const liveExams = openExams.map((exam) => {
    const stats = attemptMap[exam._id.toString()] || { started: 0, submitted: 0 };
    return {
      _id: exam._id,
      title: exam.title,
      accessToken: exam.accessToken,
      categoryName: exam.categoryId?.name || 'General',
      durationMinutes: exam.durationMinutes,
      submitted: stats.submitted,
      started: stats.started,
      eligible: activeStudents,
    };
  });

  // 3. Recent submissions (last 7)
  const recentAttempts = await Attempt.find({
    status: { $in: ['submitted', 'auto_submitted', 'force_submitted'] },
  })
    .populate('studentId', 'studentId fullName')
    .populate('examId', 'title passMark')
    .sort({ submittedAt: -1 })
    .limit(7)
    .lean();

  const recentSubmissions = recentAttempts.map((a) => {
    const totalMaxPoints = a.totalMarks || 0;
    const scoreEarned = a.score || 0;
    const percentage =
      totalMaxPoints > 0 ? Math.round((scoreEarned / totalMaxPoints) * 100) : 0;
    const passMark = a.examId?.passMark;
    const passed = passMark !== null && passMark !== undefined ? percentage >= passMark : percentage >= 50;

    return {
      _id: a._id,
      studentName: a.studentId?.fullName || a.studentId?.studentId || 'Student',
      studentId: a.studentId?.studentId || '',
      examTitle: a.examId?.title || (a.examTitle ? `${a.examTitle} (deleted)` : 'Deleted Exam'),
      examId: a.examId?._id || '',
      scoreEarned,
      totalMaxPoints,
      percentage,
      passed,
      needsGrading: a.needsGrading || false,
      submittedAt: a.submittedAt,
    };
  });

  // 4. Categories overview
  const categories = await Category.find().sort({ name: 1 }).lean();
  const categoryIds = categories.map((c) => c._id);

  const [studentCounts, examCounts] = await Promise.all([
    User.aggregate([
      { $match: { role: 'student', categoryIds: { $in: categoryIds } } },
      { $unwind: '$categoryIds' },
      { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
    ]),
    Exam.aggregate([
      { $match: { categoryId: { $in: categoryIds } } },
      { $group: { _id: '$categoryId', count: { $sum: 1 } } },
    ]),
  ]);

  const studentMap = Object.fromEntries(studentCounts.map((s) => [s._id.toString(), s.count]));
  const examMap = Object.fromEntries(examCounts.map((e) => [e._id.toString(), e.count]));

  const categoriesOverview = categories.map((c) => ({
    _id: c._id,
    name: c.name,
    studentCount: studentMap[c._id.toString()] || 0,
    examCount: examMap[c._id.toString()] || 0,
  }));

  res.json({
    overview: {
      totalStudents,
      activeStudents,
      totalExams,
      draftExams,
      openExamsCount,
      submissionsThisWeek,
    },
    liveExams,
    recentSubmissions,
    categoriesOverview,
  });
}
