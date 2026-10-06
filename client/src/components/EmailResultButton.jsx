import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api, { extractError } from '../api/client';
import { Mail, CheckCheck, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';

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
      <span
        title={t('results.noEmailTooltip')}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-800/60 text-surface-500 border border-surface-700/60 text-xs font-medium cursor-not-allowed select-none ${className}`}
      >
        <Mail className="w-3.5 h-3.5 opacity-50" />
        <span>{t('students.noEmail')}</span>
      </span>
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
  if (pendingUndo) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold animate-pulse ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>{t('results.sendingEmail')}</span>
        <button
          type="button"
          onClick={handleCancelUndo}
          className="ms-1 px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 text-[10px] font-bold uppercase transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  if (sending) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span>{t('results.sendingEmail')}</span>
      </span>
    );
  }

  // State 1: Outdated grade
  if (isOutdated) {
    return (
      <button
        type="button"
        onClick={() => handleStartEmailFlow(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm ${className}`}
        title="Grade was updated after sending. Click to send updated result."
      >
        <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
        <span>{t('results.sendUpdatedResult')}</span>
      </button>
    );
  }

  // State 2: Successfully Sent
  if (resultEmail.status === 'sent') {
    const sentDateStr = resultEmail.lastSentAt ? formatDateTime(resultEmail.lastSentAt) : '';
    const tooltipText = `Sent to ${resultEmail.sentToMasked || targetEmail} ${sentDateStr ? 'on ' + sentDateStr : ''}`;

    return (
      <span
        title={tooltipText}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 text-xs font-semibold select-none ${className}`}
      >
        <CheckCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>{t('results.emailedStatus')}</span>
      </span>
    );
  }

  // State 3: Failed previous send
  if (resultEmail.status === 'failed' || errorMessage) {
    return (
      <button
        type="button"
        onClick={() => handleStartEmailFlow(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer ${className}`}
        title={errorMessage || resultEmail.lastErrorCode || 'Failed to send email. Click to retry.'}
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
        <span>{t('common.retry')}</span>
      </button>
    );
  }

  // State 4: Default Not Sent Button
  return (
    <button
      type="button"
      onClick={() => handleStartEmailFlow(false)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm ${className}`}
      title={t('results.emailResult')}
    >
      <Mail className="w-3.5 h-3.5 text-teal-400 shrink-0" />
      <span>{t('results.emailResult')}</span>
    </button>
  );
}
