import { SystemSettings } from '../models/SystemSettings.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';
import { Exam } from '../models/Exam.js';
import { Question } from '../models/Question.js';
import { ExamSnapshot } from '../models/ExamSnapshot.js';
import { Attempt } from '../models/Attempt.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/env.js';
import { sendResultEmail } from '../services/emailService.js';

export async function getSystemSettings(req, res) {
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = await SystemSettings.create({});
  }

  const isEmailConfigured = Boolean(
    (process.env.EMAIL_USER || process.env.SMTP_USER || env.EMAIL_USER) &&
    (process.env.EMAIL_PASS || process.env.SMTP_PASS || env.EMAIL_PASS)
  );

  res.json({
    settings,
    emailConfigured: isEmailConfigured,
  });
}

export async function updateSystemSettings(req, res) {
  const { senderName, replyToEmail, resultEmailLanguage, resultEmailIncludeAnswers } = req.body;

  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = new SystemSettings({});
  }

  if (senderName !== undefined) {
    settings.senderName = String(senderName || '').trim() || 'Medresa Exam Portal';
  }
  if (replyToEmail !== undefined) {
    const trimmed = String(replyToEmail || '').trim().toLowerCase();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new ApiError(400, 'Invalid Reply-To email address format');
    }
    settings.replyToEmail = trimmed;
  }
  if (resultEmailLanguage && ['auto', 'en', 'am', 'ar'].includes(resultEmailLanguage)) {
    settings.resultEmailLanguage = resultEmailLanguage;
  }
  if (resultEmailIncludeAnswers && ['auto', 'always', 'never'].includes(resultEmailIncludeAnswers)) {
    settings.resultEmailIncludeAnswers = resultEmailIncludeAnswers;
  }

  await settings.save();
  res.json({
    settings,
    message: 'System settings updated successfully',
  });
}

export async function sendTestEmail(req, res) {
  const adminId = req.user.userId || req.user.id || req.user._id;
  const adminUser = await User.findById(adminId);
  const recipientEmail = adminUser?.email;

  if (!recipientEmail) {
    throw new ApiError(400, 'NO_ADMIN_EMAIL: Please add a valid email address to your admin profile first.');
  }

  try {
    const dummyDocxBuffer = Buffer.from('Medresa Exam Portal Test Email Document', 'utf-8');
    await sendResultEmail({
      recipient: recipientEmail,
      studentName: adminUser.fullName || 'Ustaz Admin',
      studentIdCode: 'ADMIN-TEST',
      examTitle: 'System Diagnostic Test Email',
      score: 100,
      totalMarks: 100,
      percentage: 100,
      passed: true,
      language: req.body?.language || 'en',
      docxBuffer: dummyDocxBuffer,
    });

    res.json({
      success: true,
      message: `Test email successfully sent to ${recipientEmail}`,
    });
  } catch (err) {
    throw new ApiError(500, `Failed to send test email: ${err.message || 'SMTP Configuration Issue'}`);
  }
}

export async function exportBackupData(req, res) {
  const dateStr = new Date().toISOString().split('T')[0];

  const [students, categories, exams, questions, snapshots, attempts, settingsDoc] = await Promise.all([
    User.find({ role: 'student' }).select('-passwordHash -__v').lean(),
    Category.find().select('-__v').lean(),
    Exam.find().select('-__v').lean(),
    Question.find().select('-__v').lean(),
    ExamSnapshot.find().select('-__v').lean(),
    Attempt.find().select('-__v').lean(),
    SystemSettings.findOne().lean(),
  ]);

  // Update lastBackupAt timestamp
  let settings = await SystemSettings.findOne();
  if (!settings) {
    settings = new SystemSettings({});
  }
  settings.lastBackupAt = new Date();
  await settings.save();

  const payload = {
    meta: {
      version: '1.0',
      system: 'Medresa Exam Portal',
      exportedAt: new Date().toISOString(),
    },
    students,
    categories,
    exams,
    questions,
    snapshots,
    attempts,
    settings: settingsDoc || settings.toObject(),
  };

  const filename = `medresa-backup-${dateStr}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(payload, null, 2));
}
