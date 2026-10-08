import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api, { extractError } from '../api/client';
import { Mail, CheckCheck, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';
import Button from './Button';
import { StatusChip } from './Common';


export default function EmailResultButton({
  attempt,
  studentEmail,
  onSentSuccess,
  className = '',
  compact = false,
}) {
  const { t, i18n } = useTranslation();
  const [sending, setSending] = useState(false);
  const [pendingUndo, setPendingUndo] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const undoTimerRef = useRef(null);

  if (!attempt || attempt.status === 'not_started' || attempt.status === 'in_progress' || attempt.needsGrading) {
    return null; // Hidden if not submitted or needs manual grading
  }

  const resultEmail = attempt.resultEmail || { status: 'none' };
  const hasEmail = Boolean(studentEmail || attempt.studentEmail);
  const targetEmail = studentEmail || attempt.studentEmail || '';

  // Calculate if grade was updated after previous email send
  const isOutdated =
    resultEmail.status === 'sent' &&
    typeof attempt.gradeVersion === 'number' &&
    typeof resultEmail.gradeVersionSent === 'number' &&
    attempt.gradeVersion > resultEmail.gradeVersionSent;

  if (!hasEmail) {
    return (
      <StatusChip
        icon={Mail}
        label={t('students.noEmail') || 'No email'}
        variant="neutral"
        size="md"
        className={className}
      />
    );
  }

  // Trigger dispatch after 5s Undo window
  const dispatchEmailRequest = async (forceResend = false, targetLang = i18n.language) => {
    setSending(true);
    setErrorMessage('');
    try {
      const res = await api.post(`/api/results/attempt/${attempt.attemptId || attempt._id}/email`, {
        language: targetLang,
        includeAnswers: false,
        forceResend,
      });

      setSending(false);
      setPendingUndo(false);
      if (onSentSuccess) {
        onSentSuccess(res.data?.resultEmail);
      }
    } catch (err) {
      setSending(false);
      setPendingUndo(false);
      setErrorMessage(extractError(err, 'Failed to send result email').message);
    }
  };

  const handleStartEmailFlow = (forceResend = false) => {
    if (pendingUndo || sending) return;

    setPendingUndo(true);
    const masked = resultEmail.sentToMasked || targetEmail.replace(/(.{2}).*(@.*)/, '$1***$2');
    setToastMessage(`Sending result to ${masked}...`);

    undoTimerRef.current = setTimeout(() => {
      dispatchEmailRequest(forceResend);
    }, 5000);
  };

  const handleCancelUndo = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setPendingUndo(false);
    setSending(false);
  };

  // Render Pending Undo Toast / State
  if (pendingUndo || sending) {
    return (
      <Button
        variant="secondary"
        size="md"
        loading={true}
        fullWidth
        className={className}
      >
        {t('results.sendingEmail') || 'Sending...'}
      </Button>
    );
  }

  // State 1: Outdated grade
  if (isOutdated) {
    return (
      <Button
        variant="secondary"
        size="md"
        iconStart={RotateCcw}
        onClick={() => handleStartEmailFlow(true)}
        fullWidth
        className={className}
        title="Grade was updated after sending. Click to send updated result."
      >
        {t('results.sendUpdatedResult') || 'Send Update'}
      </Button>
    );
  }

  // State 2: Successfully Sent
  if (resultEmail.status === 'sent') {
    const sentDateStr = resultEmail.lastSentAt ? formatDateTime(resultEmail.lastSentAt) : '';
    const label = `${t('results.emailedStatus') || 'Emailed'}${sentDateStr ? ' · ' + sentDateStr.split(',')[0] : ''}`;

    return (
      <StatusChip
        icon={CheckCheck}
        label={label}
        variant="success"
        size="md"
        className={className}
      />
    );
  }

  // State 3: Failed previous send
  if (resultEmail.status === 'failed' || errorMessage) {
    return (
      <Button
        variant="danger-outline"
        size="md"
        iconStart={AlertCircle}
        onClick={() => handleStartEmailFlow(true)}
        fullWidth
        className={className}
        title={errorMessage || resultEmail.lastErrorCode || 'Failed to send email. Click to retry.'}
      >
        {t('common.retry') || 'Retry'}
      </Button>
    );
  }

  // State 4: Default Not Sent Button
  return (
    <Button
      variant="secondary"
      size="md"
      iconStart={Mail}
      onClick={() => handleStartEmailFlow(false)}
      fullWidth
      className={className}
      title={t('results.emailResult')}
    >
      {t('results.emailResult') || 'Email result'}
    </Button>
  );
}
