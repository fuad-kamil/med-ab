import mongoose from 'mongoose';

const sessionEventSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      default: null,
    },
    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attempt',
      default: null,
    },
    type: {
      type: String,
      enum: [
        'started',
        'blocked_login',
        'released',
        'replaced',
        'device_changed',
        'admin_release',
      ],
      required: true,
    },
    at: {
      type: Date,
      default: Date.now,
      required: true,
    },
    deviceLabel: { type: String, default: null },
    // IP stored masked (e.g. "192.168.x.x"), never raw
    ipMasked: { type: String, default: null },
  },
  { timestamps: false }
);

// 90-day TTL: events auto-delete after 90 days
sessionEventSchema.index({ at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// For efficient per-student queries
sessionEventSchema.index({ studentId: 1, at: -1 });
sessionEventSchema.index({ studentId: 1, type: 1, at: -1 });

export const SessionEvent = mongoose.model('SessionEvent', sessionEventSchema);
