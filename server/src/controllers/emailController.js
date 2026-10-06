import multer from 'multer';
import { User } from '../models/User.js';
import { ApiError } from '../middleware/errorHandler.js';
import { sendAnnouncementEmail } from '../services/emailService.js';

// Memory storage engine: files are held in RAM buffers and never saved to disk or database
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max total
  },
});

export const parseEmailAttachments = upload.array('attachments', 5); // max 5 files

export async function sendAnnouncement(req, res) {
  const { targetType, selectedStudentIds, subject, message } = req.body;

  if (!message || !message.trim()) {
    throw new ApiError(400, 'Announcement message content is required');
  }

  let studentEmails = [];

  if (targetType === 'all') {
    const students = await User.find({ role: 'student', isActive: true })
      .select('email')
      .lean();
    studentEmails = students.map((s) => s.email).filter(Boolean);
  } else {
    let ids = [];
    if (typeof selectedStudentIds === 'string') {
      try {
        ids = JSON.parse(selectedStudentIds);
      } catch {
        ids = selectedStudentIds.split(',').map((id) => id.trim());
      }
    } else if (Array.isArray(selectedStudentIds)) {
      ids = selectedStudentIds;
    }

    if (!ids || ids.length === 0) {
      throw new ApiError(400, 'No student recipients selected');
    }

    const students = await User.find({ _id: { $in: ids } })
      .select('email')
      .lean();
    studentEmails = students.map((s) => s.email).filter(Boolean);
  }

  if (studentEmails.length === 0) {
    throw new ApiError(400, 'None of the target students have an email address set.');
  }

  const result = await sendAnnouncementEmail({
    recipients: studentEmails,
    subject: subject || 'Announcement from Medresa Ustaz',
    message: message.trim(),
    files: req.files || [],
  });

  res.json({
    success: true,
    sentCount: studentEmails.length,
    message: `Announcement email sent successfully to ${studentEmails.length} student(s)`,
  });
}
