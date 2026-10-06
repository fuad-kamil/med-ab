import { v4 as uuidv4 } from 'uuid';
import { Question } from '../models/Question.js';
import { Exam } from '../models/Exam.js';
import { ApiError } from '../middleware/errorHandler.js';

export async function listQuestions(req, res) {
  const { examId } = req.params;

  const exam = await Exam.findById(examId);
  if (!exam) throw new ApiError(404, 'Exam not found');

  const questions = await Question.find({ examId })
    .sort({ order: 1 })
    .lean();

  res.json({ questions });
}

export async function createQuestion(req, res) {
  const { examId } = req.params;

  const exam = await Exam.findById(examId);
  if (!exam) throw new ApiError(404, 'Exam not found');

  // Auto-assign order
  const lastQuestion = await Question.findOne({ examId })
    .sort({ order: -1 })
    .lean();
  const order = lastQuestion ? lastQuestion.order + 1 : 0;

  // Ensure options have IDs
  const options = (req.body.options || []).map((opt) => ({
    id: opt.id || uuidv4(),
    text: opt.text,
  }));

  const question = await Question.create({
    ...req.body,
    examId,
    options,
    order,
  });

  res.status(201).json({ question });
}

export async function updateQuestion(req, res) {
  const { examId, id } = req.params;

  const question = await Question.findOne({ _id: id, examId });
  if (!question) throw new ApiError(404, 'Question not found');

  // Ensure options have IDs
  if (req.body.options) {
    req.body.options = req.body.options.map((opt) => ({
      id: opt.id || uuidv4(),
      text: opt.text,
    }));
  }

  Object.assign(question, req.body);
  await question.save();
  res.json({ question });
}

export async function deleteQuestion(req, res) {
  const { examId, id } = req.params;

  const question = await Question.findById(id);
  if (!question) throw new ApiError(404, 'Question not found');

  await Question.findByIdAndDelete(id);

  // Re-order remaining questions
  await Question.updateMany(
    { examId: question.examId, order: { $gt: question.order } },
    { $inc: { order: -1 } }
  );

  res.json({ message: 'Question deleted' });
}

export async function reorderQuestions(req, res) {
  const { examId } = req.params;
  const { questionIds } = req.body;

  const exam = await Exam.findById(examId);
  if (!exam) throw new ApiError(404, 'Exam not found');

  // Bulk update order
  const ops = questionIds.map((id, index) => ({
    updateOne: {
      filter: { _id: id, examId },
      update: { $set: { order: index } },
    },
  }));

  await Question.bulkWrite(ops);
  res.json({ message: 'Questions reordered' });
}

export async function importQuestions(req, res) {
  const { examId } = req.params;

  const exam = await Exam.findById(examId);
  if (!exam) throw new ApiError(404, 'Exam not found');

  const lastQuestion = await Question.findOne({ examId })
    .sort({ order: -1 })
    .lean();
  let nextOrder = lastQuestion ? lastQuestion.order + 1 : 0;

  const questions = req.body.questions.map((q, i) => ({
    ...q,
    examId,
    order: nextOrder + i,
    options: (q.options || []).map((opt) => ({
      id: opt.id || uuidv4(),
      text: opt.text,
    })),
  }));

  const created = await Question.insertMany(questions);
  res.status(201).json({
    imported: created.length,
    questions: created,
  });
}
