import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { parseEmailAttachments, sendAnnouncement } from '../controllers/emailController.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Admin-only email announcement routes
router.use(authenticate, requireRole('admin'));

router.post('/send-announcement', parseEmailAttachments, asyncHandler(sendAnnouncement));

export default router;
