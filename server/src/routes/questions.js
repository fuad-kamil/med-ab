import { Router } from 'express';
import {
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
  importQuestions,
} from '../controllers/questionController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import {
  createQuestionSchema,
  updateQuestionSchema,
  reorderQuestionsSchema,
  importQuestionsSchema,
} from '../validators/question.js';

const router = Router({ mergeParams: true });
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All question routes require admin auth
router.use(authenticate, requireRole('admin'));

router.get('/', asyncHandler(listQuestions));
router.post('/', validate(createQuestionSchema), asyncHandler(createQuestion));
router.put('/:id', validate(updateQuestionSchema), asyncHandler(updateQuestion));
router.delete('/:id', asyncHandler(deleteQuestion));
router.patch('/reorder', validate(reorderQuestionsSchema), asyncHandler(reorderQuestions));
router.post('/import', validate(importQuestionsSchema), asyncHandler(importQuestions));

export default router;
