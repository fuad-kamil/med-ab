import mongoose from 'mongoose';

const attemptSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    questionOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    optionOrderByQuestion: {
      type: Map,
      of: [String],
      default: new Map(),
    },
    answers: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: new Map(),
    },
    flaggedQuestions: {
      type: [mongoose.Schema.Types.ObjectId],
      default: [],
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    deadline: {
      type: Date,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitted', 'auto_submitted', 'force_submitted'],
      default: 'in_progress',
    },
    score: {
      type: Number,
      default: null,
    },
    totalMarks: {
      type: Number,
      default: null,
    },
    manualGrades: {
      type: Map,
      of: {
        marks: Number,
        feedback: String,
      },
      default: new Map(),
    },
    tabSwitchCount: {
      type: Number,
      default: 0,
    },
    extraTimeMinutes: {
      type: Number,
      default: 0,
    },
    retakeAllowed: {
      type: Boolean,
      default: false,
    },
    needsGrading: {
      type: Boolean,
      default: false,
    },
    snapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExamSnapshot',
      default: null,
    },
    examTitle: {
      type: String,
      default: '',
    },
    categoryName: {
      type: String,
      default: '',
    },
    passMark: {
      type: Number,
      default: null,
    },
    examDeleted: {
      type: Boolean,
      default: false,
    },
    gradeVersion: {
      type: Number,
      default: 1,
    },
    resultEmail: {
      status: {
        type: String,
        enum: ['none', 'sending', 'sent', 'failed'],
        default: 'none',
      },
      sentCount: { type: Number, default: 0 },
      lastSentAt: { type: Date, default: null },
      sentToMasked: { type: String, default: '' },
      sentToHash: { type: String, default: '' },
      sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      language: { type: String, default: 'en' },
      includeAnswers: { type: Boolean, default: false },
      gradeVersionSent: { type: Number, default: null },
      messageId: { type: String, default: '' },
      lastErrorCode: { type: String, default: '' },
      lockedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// Unique constraint: one active attempt per student per exam
// Retake-allowed attempts are excluded from the constraint
attemptSchema.index(
  { examId: 1, studentId: 1 },
  {
    unique: true,
    partialFilterExpression: { retakeAllowed: { $ne: true } },
  }
);

attemptSchema.index({ studentId: 1 });
attemptSchema.index({ examId: 1, status: 1 });

attemptSchema.methods.isExpired = function () {
  return new Date() > this.deadline;
};

attemptSchema.methods.remainingMs = function () {
  const remaining = this.deadline.getTime() - Date.now();
  return Math.max(0, remaining);
};

export const Attempt = mongoose.model('Attempt', attemptSchema);
