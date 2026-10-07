import crypto from 'crypto';
import { parse } from 'csv-parse/sync';
import { User } from '../models/User.js';
import { Exam } from '../models/Exam.js';
import { Attempt } from '../models/Attempt.js';
import { getNextStudentId, reserveStudentIdBlock } from '../models/Counter.js';
import { ApiError } from '../middleware/errorHandler.js';

// Generate a readable random password
function generatePassword(length = 8) {
  // Avoid confusing characters (0/O, 1/l/I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

export async function listUsers(req, res) {
  const { page = 1, limit = 50, search, active, categoryId, gender, sortBy = 'studentId', sortOrder = 'asc' } = req.query;

  const filter = { role: 'student' };
  if (active !== undefined) {
    filter.isActive = active;
  }
  if (categoryId) {
    filter.categoryIds = categoryId;
  }
  if (gender) {
    filter.gender = gender;
  }
  if (search) {
    const escaped = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { fullName: { $regex: `^${escaped}`, $options: 'i' } },
      { studentId: { $regex: `^${escaped}`, $options: 'i' } },
      { email: { $regex: `^${escaped}`, $options: 'i' } },
    ];
  }

  const numericPage = Number(page);
  const numericLimit = Number(limit);
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortObj = { [sortBy]: sortDirection };

  let query = User.find(filter)
    .select('-passwordHash -__v -failedLoginAttempts -lockedUntil')
    .populate('categoryIds', 'name description')
    .sort(sortObj);

  if (sortBy === 'studentId' && typeof query.collation === 'function') {
    query = query.collation({ locale: 'en', numericOrdering: true });
  }

  const [users, total] = await Promise.all([
    query
      .skip((numericPage - 1) * numericLimit)
      .limit(numericLimit)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    users,
    pagination: {
      page: numericPage,
      limit: numericLimit,
      total,
      pages: Math.ceil(total / numericLimit),
    },
  });
}

export async function createUser(req, res) {
  const { fullName, email, password, categoryIds, gender } = req.body;

  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    throw new ApiError(400, 'Full name is required');
  }

  const autoStudentId = await getNextStudentId();
  const rawPassword = password || generatePassword();
  const passwordHash = await User.hashPassword(rawPassword);

  const user = await User.create({
    role: 'student',
    studentId: autoStudentId,
    fullName: fullName.trim(),
    email: email ? email.trim().toLowerCase() : '',
    passwordHash,
    categoryIds: categoryIds || [],
    gender: ['male', 'female'].includes(gender) ? gender : null,
  });

  res.status(201).json({
    user: user.toSafeJSON(),
    generatedPassword: rawPassword,
  });
}

export async function updateUser(req, res) {
  const { id } = req.params;
  const updates = req.body;

  const user = await User.findById(id);
  if (!user || user.role !== 'student') {
    throw new ApiError(404, 'Student not found');
  }

  if (updates.studentId && updates.studentId !== user.studentId) {
    const dup = await User.findOne({ studentId: updates.studentId });
    if (dup) {
      throw new ApiError(409, 'A student with this ID already exists');
    }
    user.studentId = updates.studentId;
  }

  if (updates.fullName) user.fullName = updates.fullName;
  if (updates.email !== undefined) user.email = updates.email ? updates.email.trim().toLowerCase() : '';
  if (updates.isActive !== undefined) user.isActive = updates.isActive;
  if (updates.categoryIds !== undefined) user.categoryIds = updates.categoryIds;
  if (updates.gender !== undefined) user.gender = ['male', 'female'].includes(updates.gender) ? updates.gender : null;
  if (updates.password && typeof updates.password === 'string' && updates.password.trim()) {
    user.passwordHash = await User.hashPassword(updates.password.trim());
  }

  await user.save();
  res.json({ user: user.toSafeJSON() });
}

export async function deleteUser(req, res) {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user || user.role !== 'student') {
    throw new ApiError(404, 'Student not found');
  }
  await User.findByIdAndDelete(id);
  res.json({ message: 'Student deleted successfully' });
}

export async function deactivateUser(req, res) {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user || user.role !== 'student') {
    throw new ApiError(404, 'Student not found');
  }
  user.isActive = !user.isActive;
  await user.save();
  res.json({ user: user.toSafeJSON() });
}

export async function resetPassword(req, res) {
  const { id } = req.params;
  const { newPassword } = req.body;

  const user = await User.findById(id);
  if (!user || user.role !== 'student') {
    throw new ApiError(404, 'Student not found');
  }

  const password = newPassword || generatePassword();
  user.passwordHash = await User.hashPassword(password);
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  res.json({
    message: 'Password reset successfully',
    studentId: user.studentId,
    fullName: user.fullName,
    newPassword: password,
  });
}

export async function bulkAction(req, res) {
  const { action, userIds, studentIds: legacyStudentIds, selectAll, filter, gender } = req.body;
  const rawIds = userIds || legacyStudentIds;
  const ids = Array.isArray(rawIds) ? rawIds : [];

  let targetFilter = { role: 'student' };
  if (selectAll) {
    if (filter) {
      if (filter.active !== undefined) targetFilter.isActive = filter.active;
      if (filter.gender) targetFilter.gender = filter.gender;
      if (filter.search) {
        targetFilter.$or = [
          { fullName: { $regex: filter.search, $options: 'i' } },
          { studentId: { $regex: filter.search, $options: 'i' } },
          { email: { $regex: filter.search, $options: 'i' } },
        ];
      }
    }
  } else {
    if (ids.length === 0) {
      throw new ApiError(400, 'studentIds or userIds array is required');
    }
    targetFilter._id = { $in: ids };
  }

  if (action === 'activate') {
    const result = await User.updateMany(targetFilter, { $set: { isActive: true } });
    return res.json({ message: `Activated ${result.modifiedCount || ids.length} students` });
  }

  if (action === 'deactivate') {
    const result = await User.updateMany(targetFilter, { $set: { isActive: false } });
    return res.json({ message: `Deactivated ${result.modifiedCount || ids.length} students` });
  }

  if (action === 'assign_gender' || action === 'set_gender') {
    const genderVal = ['male', 'female'].includes(gender) ? gender : null;
    const result = await User.updateMany(targetFilter, { $set: { gender: genderVal } });
    return res.json({ message: `Updated gender for ${result.modifiedCount || ids.length} students` });
  }

  if (action === 'delete') {
    const result = await User.deleteMany(targetFilter);
    return res.json({ message: `Deleted ${result.deletedCount || ids.length} students` });
  }

  if (action === 'reset_passwords') {
    const students = await User.find(targetFilter);
    const results = [];
    for (const s of students) {
      const password = generatePassword();
      s.passwordHash = await User.hashPassword(password);
      s.failedLoginAttempts = 0;
      s.lockedUntil = null;
      await s.save();
      results.push({ studentId: s.studentId, fullName: s.fullName, password });
    }
    return res.json({ message: `Reset passwords for ${results.length} students`, results });
  }

  throw new ApiError(400, 'Invalid bulk action');
}

export async function bulkImport(req, res) {
  const csvText = req.body.csv;
  if (!csvText || typeof csvText !== 'string') {
    throw new ApiError(400, 'CSV data is required (send as { csv: "..." })');
  }

  let records;
  try {
    records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw new ApiError(400, `Invalid CSV format: ${err.message}`);
  }

  if (!records || records.length === 0) {
    throw new ApiError(400, 'CSV is empty');
  }

  const results = [];
  const errors = [];

  // Check if old CSV file contains studentId column
  const sampleRow = records[0] || {};
  const hadStudentIdColumn = Boolean(sampleRow.studentId || sampleRow.student_id || sampleRow.id);

  // Filter valid rows with fullName
  const validRows = [];
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const fullName = (row.fullName || row.full_name || row.name || '').trim();
    if (!fullName) {
      errors.push({ row: i + 2, error: 'Missing fullName' });
    } else {
      validRows.push({ rowIndex: i + 2, row, fullName });
    }
  }

  // Reserve sequence numbers block in file order atomically
  const reservedIds = await reserveStudentIdBlock(validRows.length);

  for (let i = 0; i < validRows.length; i++) {
    const { fullName, row, rowIndex } = validRows[i];
    const studentId = reservedIds[i];

    const rawEmail = (row.email || row.mail || '').toString().trim().toLowerCase();
    const rawGender = (row.gender || row.sex || row['ፆታ'] || '').toString().trim().toLowerCase();
    let gender = null;
    if (['male', 'm', 'ወንድ'].includes(rawGender)) gender = 'male';
    else if (['female', 'f', 'ሴት'].includes(rawGender)) gender = 'female';

    const rawPassword = (row.password || row.pass || '').toString().trim() || generatePassword();
    const passwordHash = await User.hashPassword(rawPassword);

    try {
      const user = await User.create({
        role: 'student',
        studentId,
        fullName,
        email: rawEmail,
        passwordHash,
        gender,
      });
      results.push({
        studentId: user.studentId,
        fullName: user.fullName,
        password: rawPassword,
      });
    } catch (err) {
      errors.push({ row: rowIndex, error: err.message });
    }
  }

  res.json({
    imported: results.length,
    failed: errors.length,
    notice: hadStudentIdColumn ? 'Notice: Provided Student IDs were ignored. Auto-generated IDs were assigned.' : null,
    results,
    errors,
  });
}

export async function getStudentCount(req, res) {
  const total = await User.countDocuments({ role: 'student' });
  const active = await User.countDocuments({ role: 'student', isActive: true });
  res.json({ total, active });
}

export async function getStudentDetails(req, res) {
  const { id } = req.params;

  const student = await User.findById(id)
    .populate('categoryIds', 'name description')
    .lean();

  if (!student || student.role !== 'student') {
    throw new ApiError(404, 'Student not found');
  }

  // Fetch all exams
  const exams = await Exam.find()
    .populate('categoryId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  // Fetch all attempts for this student
  const attempts = await Attempt.find({ studentId: id }).lean();
  const attemptMap = new Map(attempts.map((a) => [a.examId.toString(), a]));

  const examRecords = [];
  let totalAssigned = 0;
  let totalCompleted = 0;
  let totalAwaitingCorrection = 0;
  let totalNotTaken = 0;
  let totalScoreSum = 0;
  let gradedCount = 0;

  const studentCatIds = (student.categoryIds || []).map((c) => (c._id || c).toString());

  for (const exam of exams) {
    const allowed = exam.allowedStudents || [];
    const examCatId = exam.categoryId ? (exam.categoryId._id || exam.categoryId).toString() : null;

    let isAssigned = false;
    if (allowed.length > 0) {
      isAssigned = allowed.some((aId) => aId.toString() === student._id.toString());
    } else {
      // If allowedStudents is empty, student is assigned if category matches OR if exam/student has categories
      if (examCatId) {
        isAssigned = studentCatIds.includes(examCatId);
      } else {
        // Uncategorized exam is assigned to all students
        isAssigned = true;
      }
    }

    const attempt = attemptMap.get(exam._id.toString());

    // Only include exams where student is assigned OR has taken an attempt
    if (!isAssigned && !attempt) continue;

    if (isAssigned) totalAssigned++;

    let statusKey = 'not_taken';
    let statusText = 'Assigned - Not Taken Yet';
    let score = null;
    let totalMarks = null;
    let percentage = null;
    let passed = null;
    let submittedAt = null;

    if (attempt) {
      submittedAt = attempt.submittedAt || attempt.createdAt;
      if (attempt.status === 'in_progress') {
        statusKey = 'in_progress';
        statusText = 'Exam In Progress';
      } else {
        totalCompleted++;
        score = attempt.score ?? 0;
        totalMarks = attempt.totalMarks ?? 0;
        percentage =
          totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
        const passMark = typeof exam.passMark === 'number' ? exam.passMark : 50;
        passed = percentage >= passMark;

        if (attempt.needsGrading) {
          totalAwaitingCorrection++;
          statusKey = 'needs_correction';
          statusText = 'Awaiting Ustaz Correction';
        } else {
          gradedCount++;
          totalScoreSum += percentage;
          statusKey = 'graded';
          statusText = passed
            ? `Graded: ${percentage}% (Passed)`
            : `Graded: ${percentage}% (Failed)`;
        }
      }
    } else {
      totalNotTaken++;
    }

    examRecords.push({
      examId: exam._id,
      examTitle: exam.title,
      categoryName: exam.categoryId ? exam.categoryId.name : 'Uncategorized',
      examStatus: exam.status,
      isAssigned,
      statusKey,
      statusText,
      attemptId: attempt ? attempt._id : null,
      attemptStatus: attempt ? attempt.status : null,
      needsGrading: attempt ? Boolean(attempt.needsGrading) : false,
      score,
      totalMarks,
      percentage,
      passed,
      submittedAt,
    });
  }

  const averagePercentage =
    gradedCount > 0 ? Math.round(totalScoreSum / gradedCount) : null;

  const { passwordHash, failedLoginAttempts, lockedUntil, __v, ...safeStudent } = student;

  res.json({
    student: safeStudent,
    stats: {
      totalAssigned,
      totalCompleted,
      totalAwaitingCorrection,
      totalAwaitingGrading: totalAwaitingCorrection,
      totalNotTaken,
      averagePercentage,
    },
    exams: examRecords,
  });
}
