import mongoose from 'mongoose';

const snapshotOptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const snapshotQuestionSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: {
      type: String,
      enum: ['mcq_single', 'mcq_multi', 'true_false', 'short_answer'],
      required: true,
    },
    text: { type: String, required: true },
    options: [snapshotOptionSchema],
    correctAnswer: { type: mongoose.Schema.Types.Mixed, required: true },
    marks: { type: Number, required: true, default: 1 },
    explanation: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const examSnapshotSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subject: { type: String, default: '' },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    categoryName: { type: String, default: 'Uncategorized' },
    durationMinutes: { type: Number, default: 30 },
    passMark: { type: Number, default: 50 },
    totalMarks: { type: Number, default: 0 },
    resultsVisibility: { type: String, default: 'hidden' },
    language: { type: String, default: 'en' },
    questions: [snapshotQuestionSchema],
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

examSnapshotSchema.index({ examId: 1, deletedAt: 1 });
examSnapshotSchema.index({ deletedAt: 1, categoryId: 1 });

export const ExamSnapshot = mongoose.model('ExamSnapshot', examSnapshotSchema);
