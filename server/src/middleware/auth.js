import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './errorHandler.js';
import { User } from '../models/User.js';
import { isSingleDeviceEnabled } from '../services/sessionService.js';

const tokenVersionCache = new Map();
const CACHE_TTL_MS = 15000;

export function invalidateTokenVersionCache(userId) {
  if (!userId) return;
  const prefix = `${userId}:`;
  for (const key of tokenVersionCache.keys()) {
    if (key.startsWith(prefix)) {
      tokenVersionCache.delete(key);
    }
  }
}

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

    // Check session tokenVersion for session invalidation (with 15s TTL in-memory cache)
    if (typeof payload.tokenVersion === 'number') {
      const cacheKey = `${userId}:${payload.tokenVersion}`;
      const cached = tokenVersionCache.get(cacheKey);
      const now = Date.now();
      let user;

      if (cached && cached.expiresAt > now) {
        user = cached.user;
      } else {
        user = await User.findById(userId).select('tokenVersion isActive').lean();
        if (user && user.isActive && (user.tokenVersion || 0) === payload.tokenVersion) {
          tokenVersionCache.set(cacheKey, { user, expiresAt: now + CACHE_TTL_MS });
        } else {
          tokenVersionCache.delete(cacheKey);
        }
      }

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

/**
 * requireExamSession — placed after requireExamScope on exam routes.
 * When single-device sign-in is ON: verifies that token.sid still matches
 * the activeSession.sessionId in the DB. If not (another device claimed it),
 * returns 401 SESSION_REPLACED.
 * Adds a 30-second in-memory cache to keep heartbeat cost tiny.
 */
const sessionIdCache = new Map();
const SESSION_CACHE_TTL_MS = 30_000;

export async function requireExamSession(req, res, next) {
  const sid = req.user?.sid;
  const userId = req.user?.userId;

  // If feature is OFF or token has no sid, skip check
  if (!sid || !userId) return next();

  try {
    const enabled = await isSingleDeviceEnabled();
    if (!enabled) return next();

    const cacheKey = `${userId}:${sid}`;
    const cached = sessionIdCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      if (!cached.valid) return next(new ApiError(401, 'SESSION_REPLACED'));
      return next();
    }

    const user = await User.findById(userId).select('activeSession').lean();
    const valid = user?.activeSession?.sessionId === sid;

    sessionIdCache.set(cacheKey, { valid, expiresAt: now + SESSION_CACHE_TTL_MS });

    if (!valid) {
      return next(new ApiError(401, 'SESSION_REPLACED'));
    }
    next();
  } catch {
    // Non-critical: let the request through if the check fails (defensive)
    next();
  }
}

/** Invalidate session cache for a user (call on logout/claim) */
export function invalidateSessionCache(userId) {
  if (!userId) return;
  const prefix = `${userId}:`;
  for (const key of sessionIdCache.keys()) {
    if (key.startsWith(prefix)) sessionIdCache.delete(key);
  }
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

// Generate student exam-scoped JWT (includes sid for session tracking)
export function signStudentExamToken(userId, examId, sessionId) {
  const payload = {
    userId: userId.toString(),
    role: 'student',
    examId: examId.toString(),
  };
  if (sessionId) {
    payload.sid = sessionId;
  }
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '4h' });
}
