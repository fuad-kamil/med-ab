import { User } from '../models/User.js';
import { Exam } from '../models/Exam.js';
import { signAdminToken, signStudentExamToken } from '../middleware/auth.js';
import { ApiError } from '../middleware/errorHandler.js';

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

const COMMON_DISALLOWED_PASSWORDS = [
  '12345678',
  'password',
  'password123',
  'admin1234',
  'medresa123',
  'qwertyuiop',
  '1234567890',
];

export async function adminLogin(req, res) {
  const { fullName, password } = req.body;

  const user = await User.findOne({ role: 'admin', fullName });
  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  if (user.isLocked()) {
    const remainingMs = user.lockedUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new ApiError(423, `Account locked. Try again in ${remainingMin} minute(s).`);
  }

  const valid = await user.comparePassword(password);
  if (!valid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    throw new ApiError(401, 'Invalid credentials');
  }

  // Reset on successful login & record sign in timestamp
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastSignInAt = new Date();
  await user.save();

  const token = signAdminToken(user);
  res.json({
    token,
    user: user.toSafeJSON(),
  });
}

export async function getAdminProfile(req, res) {
  const adminId = req.user.userId || req.user.id || req.user._id;
  const user = await User.findById(adminId);
  if (!user || user.role !== 'admin') {
    throw new ApiError(404, 'Admin profile not found');
  }
  res.json({ user: user.toSafeJSON() });
}

export async function updateAdminProfile(req, res) {
  const { fullName, email, currentPassword } = req.body;
  const adminId = req.user.userId || req.user.id || req.user._id;
  const user = await User.findById(adminId);
  if (!user || user.role !== 'admin') {
    throw new ApiError(404, 'Admin profile not found');
  }

  if (fullName !== undefined) {
    const trimmed = String(fullName || '').trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      throw new ApiError(400, 'Full name must be between 2 and 80 characters.');
    }
    user.fullName = trimmed;
  }

  if (email !== undefined) {
    const trimmedEmail = String(email || '').trim().toLowerCase();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new ApiError(400, 'Please enter a valid email address.');
    }

    // Require current password if changing email
    if (user.email && user.email !== trimmedEmail) {
      if (!currentPassword) {
        throw new ApiError(400, 'REAUTHENTICATION_REQUIRED: Current password is required to update email address.');
      }
      const valid = await user.comparePassword(currentPassword);
      if (!valid) {
        throw new ApiError(400, 'WRONG_PASSWORD: Current password is incorrect.');
      }
    }
    user.email = trimmedEmail;
  }

  await user.save();
  res.json({
    user: user.toSafeJSON(),
    message: 'Profile updated successfully',
  });
}

export async function changeAdminPassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'Current password and new password are required.');
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, 'WEAK_PASSWORD: New password must be at least 8 characters long.');
  }

  if (currentPassword === newPassword) {
    throw new ApiError(400, 'SAME_PASSWORD: New password must be different from current password.');
  }

  if (COMMON_DISALLOWED_PASSWORDS.includes(newPassword.toLowerCase())) {
    throw new ApiError(400, 'WEAK_PASSWORD: Password is too common. Please choose a stronger password.');
  }

  const adminId = req.user.userId || req.user.id || req.user._id;
  const user = await User.findById(adminId);
  if (!user || user.role !== 'admin') {
    throw new ApiError(404, 'Admin user not found');
  }

  const valid = await user.comparePassword(currentPassword);
  if (!valid) {
    throw new ApiError(400, 'WRONG_PASSWORD: Current password is incorrect.');
  }

  user.passwordHash = await User.hashPassword(newPassword);
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  // Issue fresh token for current session
  const newToken = signAdminToken(user);

  res.json({
    token: newToken,
    user: user.toSafeJSON(),
    message: 'Password updated successfully. Other active sessions signed out.',
  });
}

export async function signOutAllDevices(req, res) {
  const adminId = req.user.userId || req.user.id || req.user._id;
  const user = await User.findById(adminId);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  const newToken = signAdminToken(user);
  res.json({
    token: newToken,
    user: user.toSafeJSON(),
    message: 'Signed out of all other sessions successfully.',
  });
}

export async function studentExamLogin(req, res) {
  const { token: examToken } = req.params;
  const { studentId, password } = req.body;

  // Find exam by access token
  const exam = await Exam.findOne({ accessToken: examToken });
  if (!exam) {
    throw new ApiError(404, 'Exam not found');
  }

  if (exam.status === 'closed') {
    throw new ApiError(403, 'This exam is closed');
  }

  if (exam.status === 'draft') {
    throw new ApiError(403, 'This exam is not yet available');
  }

  if (!exam.isWithinWindow()) {
    throw new ApiError(403, 'This exam is outside its scheduled time window');
  }

  // Find student
  const student = await User.findOne({ studentId, role: 'student' });
  if (!student) {
    throw new ApiError(401, 'Invalid student ID or password');
  }

  if (!student.isActive) {
    throw new ApiError(403, 'Your account has been deactivated. Contact your teacher.');
  }

  if (student.isLocked()) {
    const remainingMs = student.lockedUntil.getTime() - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    throw new ApiError(423, `Account locked. Try again in ${remainingMin} minute(s).`);
  }

  const valid = await student.comparePassword(password);
  if (!valid) {
    student.failedLoginAttempts += 1;
    if (student.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      student.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      student.failedLoginAttempts = 0;
    }
    await student.save();
    throw new ApiError(401, 'Invalid student ID or password');
  }

  // Check if student is allowed for this exam
  if (exam.allowedStudents.length > 0) {
    const isAllowed = exam.allowedStudents.some(
      (id) => id.toString() === student._id.toString()
    );
    if (!isAllowed) {
      throw new ApiError(403, 'You are not authorized for this exam');
    }
  }

  // Reset failed attempts
  student.failedLoginAttempts = 0;
  student.lockedUntil = null;
  await student.save();

  const jwtToken = signStudentExamToken(student._id, exam._id);
  res.json({
    token: jwtToken,
    user: student.toSafeJSON(),
    exam: {
      _id: exam._id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      status: exam.status,
    },
  });
}
