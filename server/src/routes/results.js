import { Router } from 'express';
import {
  getResultsSummary,
  getExamResults,
  getStudentResults,
  exportResultsCsv,
  getAttemptDetail,
  gradeQuestion,
  resetAttempt,
  downloadAttemptDocx,
  deleteExamResults,
  deleteSelectedAttempts,
} from '../controllers/resultsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

import {
  sendStudentResultEmail,
  batchEmailResults,
} from '../controllers/resultEmailController.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All results routes require admin auth
router.use(authenticate, requireRole('admin'));

router.get('/summary', asyncHandler(getResultsSummary));
router.get('/export', asyncHandler(exportResultsCsv));
router.get('/exam/:examId', asyncHandler(getExamResults));
router.delete('/exam/:examId/clear-results', asyncHandler(deleteExamResults));
router.post('/exam/:examId/email-batch', asyncHandler(batchEmailResults));
router.post('/attempts/delete-selected', asyncHandler(deleteSelectedAttempts));
router.get('/student/:studentId', asyncHandler(getStudentResults));
router.get('/attempt/:attemptId', asyncHandler(getAttemptDetail));
router.get('/attempt/:attemptId/download-doc', asyncHandler(downloadAttemptDocx));
router.post('/attempt/:attemptId/email', asyncHandler(sendStudentResultEmail));
router.post('/attempt/:attemptId/grade/:questionId', asyncHandler(gradeQuestion));
router.delete('/attempt/:attemptId', asyncHandler(resetAttempt));

export default router;
