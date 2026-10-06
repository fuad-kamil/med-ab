import crypto from 'crypto';
import { Attempt } from '../models/Attempt.js';
import { User } from '../models/User.js';
import { ApiError } from '../middleware/errorHandler.js';
import { buildAttemptReportDocx } from './resultsController.js';
import { sendResultEmail, maskEmail } from '../services/emailService.js';

function hashString(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex');
}

/**
 * Send result email to student for a graded attempt
 */
export async function sendStudentResultEmail(req, res) {
  const { attemptId } = req.params;
  const { language = 'en', includeAnswers = false, forceResend = false } = req.body || {};

  // 1. Fetch attempt and check eligibility (must be submitted & fully graded)
  const attempt = await Attempt.findById(attemptId).populate('studentId').lean();
  if (!attempt) {
    throw new ApiError(404, 'Attempt not found');
  }

  if (['in_progress', 'not_started'].includes(attempt.status)) {
    throw new ApiError(400, 'Cannot send result email for an attempt that is not submitted yet.');
  }

  if (attempt.needsGrading) {
    throw new ApiError(400, 'Cannot send result email while manual grading is still pending.');
  }

  const student = attempt.studentId;
  if (!student || !student.email) {
    throw new ApiError(400, 'NO_REGISTERED_EMAIL');
  }

  const studentEmail = student.email.trim();
  const emailHash = hashString(studentEmail);

  // 2. Atomic lock to prevent duplicate sending / race conditions
  const lockedAttempt = await Attempt.findOneAndUpdate(
    {
      _id: attemptId,
      'resultEmail.status': { $ne: 'sending' },
    },
    {
      $set: {
        'resultEmail.status': 'sending',
        'resultEmail.lockedAt': new Date(),
      },
    },
    { new: true }
  );

  if (!lockedAttempt) {
    return res.status(409).json({
      error: 'EMAIL_SEND_IN_PROGRESS',
      message: 'Result email dispatch is currently in progress for this attempt.',
    });
  }

  // 3. Re-send validation rules
  const currentGradeVersion = attempt.gradeVersion || 1;
  const prevResult = attempt.resultEmail || {};

  if (prevResult.status === 'sent' && !forceResend) {
    const isSameGradeVersion = prevResult.gradeVersionSent === currentGradeVersion;
    const isSameRecipient = prevResult.sentToHash === emailHash;

    if (isSameGradeVersion && isSameRecipient) {
      // Revert lock back to 'sent'
      await Attempt.findByIdAndUpdate(attemptId, { $set: { 'resultEmail.status': 'sent' } });
      return res.status(409).json({
        error: 'RESULT_ALREADY_SENT',
        message: `Result email was already sent to ${prevResult.sentToMasked || studentEmail} for this grade version.`,
        resultEmail: prevResult,
      });
    }
  }

  // Cooldown check for forceResend (10 minutes cooldown)
  if (forceResend && prevResult.lastSentAt) {
    const timeSinceLast = Date.now() - new Date(prevResult.lastSentAt).getTime();
    const tenMinsMs = 10 * 60 * 1000;
    if (timeSinceLast < tenMinsMs) {
      const waitSecs = Math.ceil((tenMinsMs - timeSinceLast) / 1000);
      await Attempt.findByIdAndUpdate(attemptId, { $set: { 'resultEmail.status': prevResult.status || 'sent' } });
      throw new ApiError(429, `Please wait ${Math.ceil(waitSecs / 60)} minutes before resending result email to this student.`);
    }

    if ((prevResult.sentCount || 0) >= 3) {
      await Attempt.findByIdAndUpdate(attemptId, { $set: { 'resultEmail.status': prevResult.status || 'sent' } });
      throw new ApiError(400, 'Maximum send limit (3 attempts) reached for this student result.');
    }
  }

  try {
    // 4. Generate docx report in-memory
    const { buffer: docxBuffer } = await buildAttemptReportDocx(attemptId);

    const score = attempt.score ?? 0;
    const totalMarks = attempt.totalMarks ?? 0;
    const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
    const passMark = attempt.passMark ?? 50;
    const passed = percentage >= passMark;

    // 5. Dispatch email
    const info = await sendResultEmail({
      recipient: studentEmail,
      studentName: student.fullName,
      studentIdCode: student.studentId,
      examTitle: attempt.examTitle || 'Exam',
      score,
      totalMarks,
      percentage,
      passed,
      language,
      docxBuffer,
    });

    const updatedResultEmail = {
      status: 'sent',
      sentCount: (prevResult.sentCount || 0) + 1,
      lastSentAt: new Date(),
      sentToMasked: maskEmail(studentEmail),
      sentToHash: emailHash,
      sentBy: req.user?._id || null,
      language,
      includeAnswers,
      gradeVersionSent: currentGradeVersion,
      messageId: info.messageId || '',
      lastErrorCode: '',
      lockedAt: null,
    };

    await Attempt.findByIdAndUpdate(attemptId, {
      $set: { resultEmail: updatedResultEmail },
    });

    res.json({
      success: true,
      message: `Result email successfully sent to ${maskEmail(studentEmail)}.`,
      resultEmail: updatedResultEmail,
    });
  } catch (err) {
    const lastErrorCode = err.message || 'EMAIL_DISPATCH_FAILED';

    const failedResultEmail = {
      ...prevResult,
      status: 'failed',
      lastErrorCode,
      lockedAt: null,
    };

    await Attempt.findByIdAndUpdate(attemptId, {
      $set: { resultEmail: failedResultEmail },
    });

    throw new ApiError(500, `Failed to send result email: ${lastErrorCode}`);
  }
}

/**
 * Batch email results to multiple eligible students
 */
export async function batchEmailResults(req, res) {
  const { attemptIds = [], language = 'en', includeAnswers = false } = req.body || {};

  if (!Array.isArray(attemptIds) || attemptIds.length === 0) {
    throw new ApiError(400, 'No attempt IDs specified for batch email.');
  }

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const details = [];

  for (const attemptId of attemptIds) {
    const attempt = await Attempt.findById(attemptId).populate('studentId').lean();
    if (!attempt || !attempt.studentId?.email || attempt.needsGrading || ['in_progress', 'not_started'].includes(attempt.status)) {
      skippedCount++;
      details.push({ attemptId, status: 'skipped', reason: 'Ineligible or missing email' });
      continue;
    }

    try {
      const { buffer: docxBuffer } = await buildAttemptReportDocx(attemptId);
      const student = attempt.studentId;

      const score = attempt.score ?? 0;
      const totalMarks = attempt.totalMarks ?? 0;
      const percentage = totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0;
      const passMark = attempt.passMark ?? 50;
      const passed = percentage >= passMark;

      const info = await sendResultEmail({
        recipient: student.email,
        studentName: student.fullName,
        studentIdCode: student.studentId,
        examTitle: attempt.examTitle || 'Exam',
        score,
        totalMarks,
        percentage,
        passed,
        language,
        docxBuffer,
      });

      const updatedResultEmail = {
        status: 'sent',
        sentCount: (attempt.resultEmail?.sentCount || 0) + 1,
        lastSentAt: new Date(),
        sentToMasked: maskEmail(student.email),
        sentToHash: hashString(student.email),
        sentBy: req.user?._id || null,
        language,
        includeAnswers,
        gradeVersionSent: attempt.gradeVersion || 1,
        messageId: info.messageId || '',
        lastErrorCode: '',
        lockedAt: null,
      };

      await Attempt.findByIdAndUpdate(attemptId, {
        $set: { resultEmail: updatedResultEmail },
      });

      sentCount++;
      details.push({ attemptId, status: 'sent', to: maskEmail(student.email) });

      // Short delay between sends to respect SMTP rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (err) {
      failedCount++;
      details.push({ attemptId, status: 'failed', error: err.message });
    }
  }

  res.json({
    sentCount,
    skippedCount,
    failedCount,
    total: attemptIds.length,
    details,
  });
}
