import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const userSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['admin', 'student'],
      required: true,
      default: 'student',
    },
    studentId: {
      type: String,
      trim: true,
      default: null,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    passwordHash: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    gender: {
      type: String,
      enum: ['male', 'female', null],
      default: null,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    lastSignInAt: {
      type: Date,
      default: null,
    },
    activeSession: {
      sessionId: { type: String, default: null },
      deviceKeyHash: { type: String, default: null },
      deviceLabel: { type: String, default: null },
      ipMasked: { type: String, default: null },
      examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', default: null },
      attemptId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', default: null },
      startedAt: { type: Date, default: null },
      lastSeenAt: { type: Date, default: null },
      leaseExpiresAt: { type: Date, default: null },
      status: { type: String, enum: ['active', 'released'], default: null },
      releasedAt: { type: Date, default: null },
      releaseReason: {
        type: String,
        enum: ['logout', 'submit', 'expired', 'admin', 'forced', 'replaced'],
        default: null,
      },
      blockedCount: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// Unique sparse index — only students have studentId
userSchema.index({ studentId: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, studentId: 1 });
userSchema.index({ categoryIds: 1 });
userSchema.index({ gender: 1 });

// Hash password helper (used by controllers, not a pre-save hook so we control when)
userSchema.statics.hashPassword = async function (plaintext) {
  return bcrypt.hash(plaintext, 12);
};

// Hash a device key (sha256, hex)
userSchema.statics.hashDeviceKey = function (deviceKey) {
  return crypto.createHash('sha256').update(String(deviceKey)).digest('hex');
};

userSchema.methods.comparePassword = async function (plaintext) {
  return bcrypt.compare(plaintext, this.passwordHash);
};

userSchema.methods.isLocked = function () {
  if (!this.lockedUntil) return false;
  return this.lockedUntil > new Date();
};

// Strip sensitive fields when converting to JSON
userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.failedLoginAttempts;
  delete obj.lockedUntil;
  delete obj.__v;
  // Remove sensitive session internals from public-facing JSON
  if (obj.activeSession) {
    delete obj.activeSession.deviceKeyHash;
    delete obj.activeSession.ipMasked;
  }
  return obj;
};

export const User = mongoose.model('User', userSchema);
