import mongoose from 'mongoose';
import crypto from 'crypto';

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 480,
    },
    status: {
      type: String,
      enum: ['draft', 'open', 'closed'],
      default: 'draft',
    },
    accessToken: {
      type: String,
      default: () => crypto.randomBytes(24).toString('hex'),
    },
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },
    shuffleOptions: {
      type: Boolean,
      default: false,
    },
    resultsReleased: {
      type: Boolean,
      default: false,
    },
    passMark: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    allowedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    closeAction: {
      type: String,
      enum: ['block_new', 'force_submit'],
      default: 'block_new',
    },
    language: {
      type: String,
      enum: ['en', 'am', 'ar'],
      default: 'en',
    },
    subject: {
      type: String,
      trim: true,
      default: '',
    },
    instructions: {
      type: String,
      trim: true,
      default: '',
    },
    requireFullscreen: {
      type: Boolean,
      default: false,
    },
    preventTabSwitch: {
      type: Boolean,
      default: false,
    },
    maxTabSwitches: {
      type: Number,
      default: 0,
    },
    startAt: {
      type: Date,
      default: null,
    },
    endAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export function isExamWithinWindow(exam) {
  if (!exam) return false;
  const now = new Date();
  if (exam.startAt && now < new Date(exam.startAt)) return false;
  if (exam.endAt && now > new Date(exam.endAt)) return false;
  return true;
}

examSchema.methods.isWithinWindow = function () {
  return isExamWithinWindow(this);
};

examSchema.index({ accessToken: 1 }, { unique: true });
examSchema.index({ status: 1 });
examSchema.index({ categoryId: 1 });
examSchema.index({ status: 1, createdAt: -1 });
examSchema.index({ categoryId: 1, createdAt: -1 });

examSchema.methods.regenerateToken = function () {
  this.accessToken = crypto.randomBytes(24).toString('hex');
  return this.accessToken;
};

export const Exam = mongoose.model('Exam', examSchema);
