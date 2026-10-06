import express from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireExamScope } from '../middleware/auth.js';
import { studentLoginSchema, saveProgressSchema } from '../validators/student.js';
import {
  loginAndStartExam,
  getActiveExam,
  saveProgress,
  submitExam,
  getResult,
  downloadStudentResultDocx,
} from '../controllers/studentController.js';

const router = express.Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Public: Student entrance (login with token + studentId + password)
router.post('/login', validate(studentLoginSchema), asyncHandler(loginAndStartExam));

// Authenticated (requires student exam JWT token)
router.use(authenticate, requireExamScope);

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
