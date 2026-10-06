import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

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
  },
  { timestamps: true }
);

// Unique sparse index — only students have studentId
userSchema.index({ studentId: 1 }, { unique: true, sparse: true });
userSchema.index({ categoryIds: 1 });
userSchema.index({ gender: 1 });

// Hash password helper (used by controllers, not a pre-save hook so we control when)
userSchema.statics.hashPassword = async function (plaintext) {
  return bcrypt.hash(plaintext, 12);
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
  return obj;
};

export const User = mongoose.model('User', userSchema);
