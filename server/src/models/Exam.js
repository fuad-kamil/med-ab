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
  },
  { timestamps: true }
);

examSchema.index({ accessToken: 1 }, { unique: true });
examSchema.index({ status: 1 });
examSchema.index({ categoryId: 1 });

examSchema.methods.regenerateToken = function () {
  this.accessToken = crypto.randomBytes(24).toString('hex');
  return this.accessToken;
};

export const Exam = mongoose.model('Exam', examSchema);
