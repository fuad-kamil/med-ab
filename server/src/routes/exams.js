import { Router } from 'express';
import {
  listExams,
  createExam,
  getExam,
  updateExam,
  duplicateExam,
  updateStatus,
  regenerateToken,
  releaseResults,
  getExamByToken,
  deleteExam,
  downloadExam,
  addExtraTime,
  getInProgressStudents,
} from '../controllers/examController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { createExamSchema, updateExamSchema, updateStatusSchema } from '../validators/exam.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public route — exam info by token (for student gate page)
router.get('/by-token/:token', asyncHandler(getExamByToken));
router.get('/public/:token', asyncHandler(getExamByToken));

// Admin-only routes below
router.use(authenticate, requireRole('admin'));

router.get('/', asyncHandler(listExams));
router.post('/', validate(createExamSchema), asyncHandler(createExam));
router.get('/:id', asyncHandler(getExam));
router.get('/:id/in-progress-students', asyncHandler(getInProgressStudents));
router.put('/:id', validate(updateExamSchema), asyncHandler(updateExam));
router.delete('/:id', asyncHandler(deleteExam));
router.post('/:id/duplicate', asyncHandler(duplicateExam));
router.post('/:id/add-time', asyncHandler(addExtraTime));
router.patch('/:id/status', validate(updateStatusSchema), asyncHandler(updateStatus));
router.patch('/:id/regenerate-token', asyncHandler(regenerateToken));
router.patch('/:id/release-results', asyncHandler(releaseResults));
router.get('/:id/download', asyncHandler(downloadExam));

export default router;

