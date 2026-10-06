import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const optionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: () => uuidv4(),
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['mcq_single', 'mcq_multi', 'true_false', 'short_answer'],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },
    options: [optionSchema],
    correctAnswer: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      // String (option id) for mcq_single/true_false,
      // [String] for mcq_multi,
      // String for short_answer
    },
    marks: {
      type: Number,
      required: true,
      min: 0.5,
      default: 1,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

questionSchema.index({ examId: 1, order: 1 });

// Strip correct answers and explanations for student-facing responses
questionSchema.methods.toStudentJSON = function (optionOrder) {
  const obj = this.toObject();
  delete obj.correctAnswer;
  delete obj.explanation;
  delete obj.__v;

  // Reorder options if optionOrder is provided
  if (optionOrder && obj.options && obj.options.length > 0) {
    const optionMap = new Map(obj.options.map((o) => [o.id, o]));
    obj.options = optionOrder
      .map((id) => optionMap.get(id))
      .filter(Boolean);
  }

  return obj;
};

export const Question = mongoose.model('Question', questionSchema);
