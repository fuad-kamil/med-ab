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
  },
  { timestamps: true }
);

export const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
