import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { Exam } from '../models/Exam.js';
import { ApiError } from '../middleware/errorHandler.js';

export async function listCategories(req, res) {
  const categories = await Category.find().sort({ name: 1 }).lean();

  // Get student and exam counts per category
  const categoryIds = categories.map((c) => c._id);

  const studentCounts = await User.aggregate([
    { $match: { role: 'student', categoryIds: { $in: categoryIds } } },
    { $unwind: '$categoryIds' },
    { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
  ]);
  const studentCountMap = Object.fromEntries(
    studentCounts.map((s) => [s._id.toString(), s.count])
  );

  const examCounts = await Exam.aggregate([
    { $match: { categoryId: { $in: categoryIds } } },
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]);
  const examCountMap = Object.fromEntries(
    examCounts.map((e) => [e._id.toString(), e.count])
  );

  const enriched = categories.map((c) => ({
    ...c,
    studentCount: studentCountMap[c._id.toString()] || 0,
    examCount: examCountMap[c._id.toString()] || 0,
  }));

  res.json({ categories: enriched });
}

export async function createCategory(req, res) {
  const { name, description } = req.body;

  const existing = await Category.findOne({ name });
  if (existing) {
    throw new ApiError(409, 'A category with this name already exists');
  }

  const category = await Category.create({ name, description });
  res.status(201).json({ category });
}

export async function updateCategory(req, res) {
  const { id } = req.params;
  const updates = req.body;

  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  if (updates.name && updates.name !== category.name) {
    const dup = await Category.findOne({ name: updates.name });
    if (dup) {
      throw new ApiError(409, 'A category with this name already exists');
    }
    category.name = updates.name;
  }

  if (updates.description !== undefined) {
    category.description = updates.description;
  }

  await category.save();
  res.json({ category });
}

export async function deleteCategory(req, res) {
  const { id } = req.params;

  const category = await Category.findById(id);
  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Check for students in this category
  const studentCount = await User.countDocuments({ categoryIds: id });
  if (studentCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete "${category.name}": ${studentCount} student(s) are still assigned to it. Reassign them first.`
    );
  }

  // Check for exams in this category
  const examCount = await Exam.countDocuments({ categoryId: id });
  if (examCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete "${category.name}": ${examCount} exam(s) are still assigned to it. Reassign them first.`
    );
  }

  await Category.findByIdAndDelete(id);
  res.json({ message: 'Category deleted' });
}
