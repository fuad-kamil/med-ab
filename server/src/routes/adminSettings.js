import { Router } from 'express';
import {
  getSystemSettings,
  updateSystemSettings,
  sendTestEmail,
  exportBackupData,
} from '../controllers/adminSettingsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All settings routes require admin auth
router.use(authenticate, requireRole('admin'));

router.get('/', asyncHandler(getSystemSettings));
router.put('/', asyncHandler(updateSystemSettings));
router.post('/test-email', asyncHandler(sendTestEmail));
router.get('/backup/export', asyncHandler(exportBackupData));

export default router;
