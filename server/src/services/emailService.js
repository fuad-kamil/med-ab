import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

/**
  Creates a Nodemailer transporter based on env vars or supplied credentials.
 */
export function createTransporter(customConfig = {}) {
  const user = customConfig.user || process.env.SMTP_USER || env.SMTP_USER;
  const pass = customConfig.pass || process.env.SMTP_PASS || env.SMTP_PASS;
  const host = customConfig.host || process.env.SMTP_HOST || env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(customConfig.port || process.env.SMTP_PORT || env.SMTP_PORT || 465);

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for other ports
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

/**
  Sends announcement email to recipients with optional file attachments.
  No database storage is used. Files exist only in memory buffers.
 */
export async function sendAnnouncementEmail({
  recipients = [], // array of email strings
  subject = '',
  message = '',
  files = [], // multer buffer objects: [{ originalname, buffer, mimetype }]
  smtpConfig = {},
}) {
  if (!recipients || recipients.length === 0) {
    throw new Error('No recipients provided');
  }

  const transporter = createTransporter(smtpConfig);

  if (!transporter) {
    throw new Error(
      'Email credentials not configured. Please add SMTP_USER and SMTP_PASS to your server environment or Settings.'
    );
  }

  const senderUser = smtpConfig.user || process.env.SMTP_USER || env.SMTP_USER;
  const fromAddress = `Medresa Exam Portal <${senderUser}>`;

  // Format file attachments for Nodemailer
  const attachments = files.map((file) => ({
    filename: file.originalname,
    content: file.buffer,
    contentType: file.mimetype,
  }));

  // Convert plain text to simple clean HTML template
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px; background-color: #ffffff;">
      <div style="background-color: #0d9488; padding: 16px 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Medresa Exam Portal</h2>
        <p style="color: #ccfbf1; margin: 4px 0 0 0; font-size: 13px;">Announcement from Ustaz</p>
      </div>

      <div style="color: #1e293b; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">
${message}
      </div>

      ${
        attachments.length > 0
          ? `<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px;">
              📎 <strong>Attached Files (${attachments.length}):</strong>
              <ul>
                ${attachments.map((a) => `<li>${a.filename}</li>`).join('')}
              </ul>
            </div>`
          : ''
      }

      <div style="margin-top: 30px; padding-top: 16px; border-top: 1px solid #cbd5e1; font-size: 12px; color: #94a3b8; text-align: center;">
        Sent via Medresa Exam Portal • Do not reply directly to this automated email.
      </div>
    </div>
  `;

  // Send email to all recipients (BCC for privacy)
  const mailOptions = {
    from: fromAddress,
    bcc: recipients,
    subject: subject || 'Announcement from Medresa Ustaz',
    text: message,
    html: htmlBody,
    attachments,
  };

  const info = await transporter.sendMail(mailOptions);
  return {
    success: true,
    messageId: info.messageId,
    recipientCount: recipients.length,
  };
}

/**
 * Mask email address for privacy display (e.g. m***@gmail.com)
 */
export function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

/**
 * Send student exam result email with attached .docx report paper
 */
export async function sendResultEmail({
  recipient,
  studentName,
  studentIdCode,
  examTitle,
  score,
  totalMarks,
  percentage,
  passed,
  language = 'en',
  docxBuffer,
  smtpConfig = {},
}) {
  const transporter = createTransporter(smtpConfig);
  if (!transporter) {
    throw new Error(
      'Email credentials not configured. Please add SMTP_USER and SMTP_PASS to your server environment or Settings.'
    );
  }

  const senderUser = smtpConfig.user || process.env.SMTP_USER || env.SMTP_USER;
  const fromAddress = `Medresa Exam Portal <${senderUser}>`;

  const isRtl = language === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';

  let subject = '';
  let bodyTitle = '';
  let greeting = '';
  let resultText = '';
  let scoreText = '';
  let attachmentNotice = '';

  if (language === 'ar') {
    subject = `نتيجة الاختبار - ${examTitle} - ${studentName}`;
    bodyTitle = 'النتيجة الرسمية للاختبار';
    greeting = `عزيزي الطالب / عزيزتي الطالبة ${studentName} (${studentIdCode})،`;
    resultText = `نحيطكم علماً بأنه قد تم تصحيح وإصدار نتيجتكم لاختبار: <strong>${examTitle}</strong>.`;
    scoreText = `الدرجة: <strong>${score} / ${totalMarks}</strong> (${percentage}% - ${passed ? 'ناجح 🎉' : 'بحاجة إلى تحسين'})`;
    attachmentNotice = 'مرفق مع هذا البريد التقرير الشامل لنتيجتك بصيغة Word (.docx).';
  } else if (language === 'am') {
    subject = `የፈተና ውጤት - ${examTitle} - ${studentName}`;
    bodyTitle = 'የፈተና ውጤት ሪፖርት';
    greeting = `ውድ ተማሪ ${studentName} (${studentIdCode})፣`;
    resultText = `የፈተናዎ <strong>${examTitle}</strong> ውጤት ተስተካክሎ ተለቋል።`;
    scoreText = `ውጤት: <strong>${score} / ${totalMarks}</strong> (${percentage}% - ${passed ? 'አልፈዋል 🎉' : 'ማሻሻል ያስፈልጋል'})`;
    attachmentNotice = 'ሙሉ የፈተና ውጤትዎ በWord (.docx) ሰነድ ተያይዟል።';
  } else {
    subject = `Exam Result - ${examTitle} - ${studentName}`;
    bodyTitle = 'Official Exam Result Report';
    greeting = `Dear ${studentName} (${studentIdCode}),`;
    resultText = `Your result for the exam <strong>${examTitle}</strong> has been graded and finalized.`;
    scoreText = `Score: <strong>${score} / ${totalMarks}</strong> (${percentage}% - ${passed ? 'Passed 🎉' : 'Needs Improvement'})`;
    attachmentNotice = 'Attached to this email is your official detailed result report (.docx file).';
  }

  const htmlBody = `
    <div dir="${dir}" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; text-align: ${isRtl ? 'right' : 'left'};">
      <div style="background-color: #0d9488; padding: 18px 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
        <h2 style="color: #ffffff; margin: 0; font-size: 20px;">Medresa Exam Portal</h2>
        <p style="color: #ccfbf1; margin: 4px 0 0 0; font-size: 13px;">${bodyTitle}</p>
      </div>

      <p style="color: #1e293b; font-size: 15px; margin-bottom: 12px;">${greeting}</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.6;">${resultText}</p>

      <div style="margin: 20px 0; padding: 16px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; text-align: center;">
        <p style="font-size: 16px; color: #0f172a; margin: 0;">${scoreText}</p>
      </div>

      <p style="color: #64748b; font-size: 13px; line-height: 1.5;">${attachmentNotice}</p>

      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
        Medresa Exam Portal • Automated Notification
      </div>
    </div>
  `;

  const safeExamTitle = examTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const safeStudentId = studentIdCode.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const filename = `Result_${safeExamTitle}_${safeStudentId}.docx`;

  const mailOptions = {
    from: fromAddress,
    to: recipient,
    subject,
    html: htmlBody,
    text: `${greeting}\n\n${resultText}\n${scoreText}\n\n${attachmentNotice}`,
    attachments: [
      {
        filename,
        content: docxBuffer,
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}
