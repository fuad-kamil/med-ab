import { Router } from 'express';
import {
  adminLogin,
  studentExamLogin,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  signOutAllDevices,
} from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { adminLoginSchema, studentExamLoginSchema } from '../validators/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

// Wrap async handlers
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post(
  '/admin/login',
  authLimiter,
  validate(adminLoginSchema),
  asyncHandler(adminLogin)
);

router.get('/admin/profile', authenticate, requireRole('admin'), asyncHandler(getAdminProfile));
router.put('/admin/profile', authenticate, requireRole('admin'), asyncHandler(updateAdminProfile));
router.put('/admin/change-password', authenticate, requireRole('admin'), asyncHandler(changeAdminPassword));
router.post('/admin/signout-all', authenticate, requireRole('admin'), asyncHandler(signOutAllDevices));

router.post(
  '/exam/:token',
  authLimiter,
  validate(studentExamLoginSchema),
  asyncHandler(studentExamLogin)
);

export default router;
