import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './errorHandler.js';
import { User } from '../models/User.js';

// Verify JWT and attach user info to req
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Authentication required'));
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    const userId = payload.userId || payload.id || payload._id;

    // Check session tokenVersion for session invalidation
    if (typeof payload.tokenVersion === 'number') {
      const user = await User.findById(userId).select('tokenVersion isActive').lean();
      if (!user || !user.isActive || (user.tokenVersion || 0) !== payload.tokenVersion) {
        return next(new ApiError(401, 'TOKEN_EXPIRED'));
      }
    }

    req.user = {
      ...payload,
      id: userId,
      userId: userId,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ApiError(401, 'Token expired'));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new ApiError(401, 'Invalid token'));
    }
    next(err);
  }
}

// Middleware factory to check for specific exam token scope
export function requireExamScope(req, res, next) {
  if (!req.user.examId) {
    return next(new ApiError(403, 'This token is not scoped to an exam'));
  }
  next();
}

// Generate admin JWT
export function signAdminToken(userOrId) {
  const userId = typeof userOrId === 'object' ? userOrId._id || userOrId.id : userOrId;
  const tokenVersion = typeof userOrId === 'object' && typeof userOrId.tokenVersion === 'number'
    ? userOrId.tokenVersion
    : 0;

  return jwt.sign(
    { userId: userId.toString(), role: 'admin', tokenVersion },
    env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

// Generate student exam-scoped JWT
export function signStudentExamToken(userId, examId) {
  return jwt.sign(
    { userId: userId.toString(), role: 'student', examId: examId.toString() },
    env.JWT_SECRET,
    { expiresIn: '4h' }
  );
}
