import { Router } from 'express';
import {
  listUsers,
  createUser,
  updateUser,
  deactivateUser,
  deleteUser,
  resetPassword,
  bulkAction,
  bulkImport,
  getStudentCount,
  getStudentDetails,
} from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  userQuerySchema,
} from '../validators/user.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All user routes require admin auth
router.use(authenticate, requireRole('admin'));

router.get('/', validateQuery(userQuerySchema), asyncHandler(listUsers));
router.get('/count', asyncHandler(getStudentCount));
router.get('/:id/details', asyncHandler(getStudentDetails));
router.get('/:id/profile', asyncHandler(getStudentDetails));
router.post('/', validate(createUserSchema), asyncHandler(createUser));
router.post('/bulk-action', asyncHandler(bulkAction));
router.post('/bulk-import', asyncHandler(bulkImport));
router.put('/:id', validate(updateUserSchema), asyncHandler(updateUser));
router.delete('/:id', asyncHandler(deleteUser));
router.patch('/:id/deactivate', asyncHandler(deactivateUser));
router.post('/:id/reset-password', validate(resetPasswordSchema), asyncHandler(resetPassword));

export default router;
