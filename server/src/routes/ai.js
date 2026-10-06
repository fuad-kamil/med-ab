import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { chat, formatQuestions, generateQuestions } from '../controllers/aiController.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate);
router.use(requireRole('admin'));

router.post('/chat', asyncHandler(chat));
router.post('/format-questions', asyncHandler(formatQuestions));
router.post('/generate-questions', asyncHandler(generateQuestions));

export default router;
