import express from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireExamScope, requireExamSession } from '../middleware/auth.js';
import { studentLoginSchema, saveProgressSchema } from '../validators/student.js';
import { claimLimiter, heartbeatLimiter } from '../middleware/rateLimiter.js';
import {
  loginAndStartExam,
  getActiveExam,
  saveProgress,
  submitExam,
  getResult,
  downloadStudentResultDocx,
  sessionClaimWithToken,
  sessionHeartbeat,
  logoutStudent,
  softReleaseStudentSession,
} from '../controllers/studentController.js';

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public: Student entrance (login with token + studentId + password)
router.post('/login', validate(studentLoginSchema), asyncHandler(loginAndStartExam));

// Public: Retry claim using waitToken (no password; uses claimLimiter)
router.post('/session/claim', claimLimiter, asyncHandler(sessionClaimWithToken));

// Public (text/plain CORS-safelisted for sendBeacon): soft-release on pagehide
router.post(
  '/session/release-soft',
  express.text({ type: 'text/plain' }),
  asyncHandler(softReleaseStudentSession)
);

// Authenticated (requires student exam JWT token)
router.use(authenticate, requireExamScope);

// Session heartbeat (no requireExamSession — the heartbeat itself renews the sid)
router.post('/session/heartbeat', heartbeatLimiter, asyncHandler(sessionHeartbeat));

// Logout
router.post('/logout', asyncHandler(logoutStudent));

// All remaining routes validate the session id
router.use(requireExamSession);

// Get active exam & questions
router.get('/exam', asyncHandler(getActiveExam));

// Save progress (autosave)
router.post('/save-progress', validate(saveProgressSchema), asyncHandler(saveProgress));

// Submit exam
router.post('/submit', asyncHandler(submitExam));

// Get result & download Word report
router.get('/result', asyncHandler(getResult));
router.get('/result/download-doc', asyncHandler(downloadStudentResultDocx));

export default router;
