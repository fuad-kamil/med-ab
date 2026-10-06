import { Router } from 'express';
import { getAdminDashboard } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', getAdminDashboard);

export default router;
