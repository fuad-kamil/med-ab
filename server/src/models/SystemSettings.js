import mongoose from 'mongoose';

const systemSettingsSchema = new mongoose.Schema(
  {
    senderName: {
      type: String,
      trim: true,
      default: 'Medresa Exam Portal',
    },
    replyToEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    resultEmailLanguage: {
      type: String,
      enum: ['auto', 'en', 'am', 'ar'],
      default: 'auto',
    },
    resultEmailIncludeAnswers: {
      type: String,
      enum: ['auto', 'always', 'never'],
      default: 'auto',
    },
    lastBackupAt: {
      type: Date,
      default: null,
    },
    // Exam security: single-device sign-in
    singleDeviceSignIn: {
      type: Boolean,
      default: true,
    },
    // Lease duration in seconds (HEARTBEAT must be < LEASE; valid range 45–300)
    leaseSeconds: {
      type: Number,
      default: 75,
      min: 45,
      max: 300,
    },
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
