import { Router } from 'express';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { validate } from '../middleware/validate.js';
import { createCategorySchema, updateCategorySchema } from '../validators/category.js';

const router = Router();
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// All category routes require admin auth
router.use(authenticate, requireRole('admin'));

router.get('/', asyncHandler(listCategories));
router.post('/', validate(createCategorySchema), asyncHandler(createCategory));
router.put('/:id', validate(updateCategorySchema), asyncHandler(updateCategory));
router.delete('/:id', asyncHandler(deleteCategory));

export default router;
