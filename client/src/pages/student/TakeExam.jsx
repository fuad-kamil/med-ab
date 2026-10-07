import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import PreferencesControls from '../../components/PreferencesControls';

// Script detector for font styling (Arabic / Ethiopic)
function detectScriptClass(text) {
  if (!text) return '';
  const arabicRegex = /[\u0600-\u06FF]/;
  const ethiopicRegex = /[\u1200-\u137F]/;
  if (arabicRegex.test(text)) return 'font-arabic text-right dir-rtl text-lg leading-relaxed';
  if (ethiopicRegex.test(text)) return 'font-ethiopic text-lg leading-relaxed';
  return '';
}

export default function TakeExam() {
  const { t } = useTranslation();
  const { token: urlToken } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [student, setStudent] = useState(() => {
    try {
      const saved = sessionStorage.getItem('studentMeta');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState([]);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);

  const [savingStatus, setSavingStatus] = useState('idle'); // 'saving' | 'saved' | 'error'
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tabWarningModal, setTabWarningModal] = useState(false);
  const [showNavSheet, setShowNavSheet] = useState(false);
  const [showThreeMinModal, setShowThreeMinModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [extraTimeNotification, setExtraTimeNotification] = useState(false);

  const studentToken =
    sessionStorage.getItem('studentExamToken') || localStorage.getItem('studentExamToken');
  const timerRef = useRef(null);
  const autosaveRef = useRef(null);
  const hasWarnedThreeMin = useRef(false);

  // Setup auth header for student calls
  const studentApiConfig = {
    headers: { Authorization: `Bearer ${studentToken}` },
  };

  // 1. Load active exam data
  const fetchExamData = useCallback(async () => {
    if (!studentToken) {
      navigate('/exam');
      return;
    }

    try {
      setLoading(true);
      const res = await api.get('/api/student/exam', studentApiConfig);
      setExam(res.data.exam);
      if (res.data.student) {
        setStudent(res.data.student);
      }
      setQuestions(res.data.questions || []);
      setRemainingSeconds(res.data.remainingSeconds || 0);

      // Load answers (merge server saved answers + localStorage fallback)
      const localKey = `exam_progress_${urlToken || 'active'}`;
      const localSaved = JSON.parse(localStorage.getItem(localKey) || '{}');
      const mergedAnswers = { ...(res.data.answers || {}), ...localSaved };

      setAnswers(mergedAnswers);
      setFlagged(res.data.flaggedQuestions || []);
      setTabSwitchCount(res.data.tabSwitchCount || 0);
      setError('');
    } catch (err) {
      const errRes = err.response?.data;
      if (errRes?.status === 'auto_submitted' || errRes?.status === 'submitted') {
        navigate('/exam/result');
        return;
      }
      setError(errRes?.error || t('errors.GENERIC'));
    } finally {
      setLoading(false);
    }
  }, [studentToken, urlToken, navigate, t]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  // 2. Countdown Timer
  useEffect(() => {
    if (loading || remainingSeconds <= 0) return;

    if (remainingSeconds <= 180 && !hasWarnedThreeMin.current) {
      hasWarnedThreeMin.current = true;
      setShowThreeMinModal(true);
    }

    timerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 181 && !hasWarnedThreeMin.current) {
          hasWarnedThreeMin.current = true;
          setShowThreeMinModal(true);
        }
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleAutoSubmitTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [loading, remainingSeconds]);

  // 3. Periodic Backend Autosave & Live Timer Sync (every 12 seconds)
  const saveProgressToBackend = useCallback(async (currentAnswers, currentFlagged, switches) => {
    if (!studentToken) return;
    try {
      setSavingStatus('saving');
      const res = await api.post(
        '/api/student/save-progress',
        {
          answers: currentAnswers,
          flaggedQuestions: currentFlagged,
          tabSwitchCount: switches,
        },
        studentApiConfig
      );
      setSavingStatus('saved');
      setTimeout(() => setSavingStatus('idle'), 2000);

      if (typeof res.data?.remainingSeconds === 'number') {
        const serverSec = res.data.remainingSeconds;
        setRemainingSeconds((prev) => {
          if (serverSec > prev + 15) {
            setExtraTimeNotification(true);
            setTimeout(() => setExtraTimeNotification(false), 8000);
            if (serverSec > 180) {
              hasWarnedThreeMin.current = false;
            }
            return serverSec;
          }
          return prev;
        });
      }
    } catch (err) {
      setSavingStatus('error');
      if (err.response?.status === 403) {
        setError(err.response?.data?.error || t('exam.examClosed'));
      }
    }
  }, [studentToken, t]);

  useEffect(() => {
    if (loading || !questions.length) return;

    autosaveRef.current = setInterval(() => {
      saveProgressToBackend(answers, flagged, tabSwitchCount);
    }, 12000);

    return () => clearInterval(autosaveRef.current);
  }, [loading, questions.length, answers, flagged, tabSwitchCount, saveProgressToBackend]);

  // Save to localStorage immediately whenever answers change
  const handleAnswerChange = (questionId, value) => {
    const updated = { ...answers, [questionId]: value };
    setAnswers(updated);
    localStorage.setItem(`exam_progress_${urlToken}`, JSON.stringify(updated));
  };

  // 4. Tab Switch Prevention & 3-Strike Warning Detection
  const lastSwitchTimeRef = useRef(0);

  const triggerTabSwitchWarning = useCallback(() => {
    const now = Date.now();
    if (now - lastSwitchTimeRef.current < 1200) return; // Prevent double trigger
    lastSwitchTimeRef.current = now;

    setTabSwitchCount((prev) => {
      const nextCount = prev + 1;
      saveProgressToBackend(answers, flagged, nextCount);

      if (nextCount >= 3) {
        // Clear student exam tokens & session
        sessionStorage.removeItem('studentExamToken');
        localStorage.removeItem('studentExamToken');
        sessionStorage.removeItem('studentMeta');

        // Redirect to login page with reason state
        navigate('/exam', {
          state: { loggedOutDueToTabSwitch: true, count: nextCount },
          replace: true,
        });
      } else {
        setTabWarningModal(true);
      }
      return nextCount;
    });
  }, [answers, flagged, saveProgressToBackend, navigate]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerTabSwitchWarning();
      }
    };

    const handleBlur = () => {
      triggerTabSwitchWarning();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [triggerTabSwitchWarning]);

  // 5. Prevent navigation / accidental window close
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Toggle Flag Question
  const toggleFlag = (qId) => {
    const updated = flagged.includes(qId)
      ? flagged.filter((id) => id !== qId)
      : [...flagged, qId];
    setFlagged(updated);
  };

  // Fullscreen toggle helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Auto-submit when timer reaches 0
  const handleAutoSubmitTimeExpired = async () => {
    try {
      setSubmitting(true);
      await api.post('/api/student/submit', { answers }, studentApiConfig);
      localStorage.removeItem(`exam_progress_${urlToken || 'active'}`);
      navigate('/exam/result', { state: { autoSubmitted: true } });
    } catch (err) {
      navigate('/exam/result');
    }
  };

  // Manual Submit Exam
  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      await api.post('/api/student/submit', { answers }, studentApiConfig);
      localStorage.removeItem(`exam_progress_${urlToken || 'active'}`);
      setShowSubmitModal(false);
      navigate('/exam/result');
    } catch (err) {
      setError(err.response?.data?.error || t('errors.GENERIC'));
    } finally {
      setSubmitting(false);
    }
  };

  // Format remaining time MM:SS or HH:MM:SS
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950 text-surface-200">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-surface-400">{t('exam.loadingEnvironment')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950 p-4">
        <div className="glass-card p-6 rounded-2xl max-w-md text-center space-y-4 border border-rose-900/50">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-bold text-surface-100">{t('exam.unableToStart')}</h2>
          <p className="text-sm text-surface-400">{error}</p>
          <Button variant="primary" onClick={() => navigate(`/exam/${urlToken}`)} className="w-full">
            {t('exam.backToEntrance')}
          </Button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter((k) => answers[k] !== undefined && answers[k] !== '' && (Array.isArray(answers[k]) ? answers[k].length > 0 : true)).length;
  const unansweredCount = questions.length - answeredCount;
  const isTimerLow = remainingSeconds < 300; // < 5 mins
  const isThreeMinWarning = remainingSeconds <= 180 && remainingSeconds > 0; // <= 3 mins
  const isTimerCritical = remainingSeconds < 60; // < 1 min



  return (
    <div className="min-h-screen bg-surface-950 text-surface-100 flex flex-col font-sans select-none pb-20 lg:pb-0">
      {/* Floating Extra Time Notification */}
      {extraTimeNotification && (
        <div className="fixed top-16 right-4 z-50 max-w-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce border border-amber-300">
          <span className="text-2xl">⏱️</span>
          <div>
            <p className="font-bold text-xs sm:text-sm">{t('exams.extraTimeAdded')}</p>
          </div>
        </div>
      )}

      {/* Sticky Top Bar */}
      <header className="sticky top-0 z-30 bg-surface-900/95 backdrop-blur-md border-b border-surface-800 px-3 sm:px-4 py-2.5 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Exam title & student progress */}
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-950/80 border border-teal-800 text-surface-100 shrink-0">
              <span className="text-sm">👤</span>
              <div className="text-left">
                <div className="text-xs font-bold text-teal-300 leading-tight">
                  {student?.fullName || t('exam.student')}
                </div>
                {student?.studentId && (
                  <div className="text-xs text-teal-400/80 font-mono" dir="ltr">
                    {student.studentId}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-bold text-surface-100 truncate">{exam?.title}</h1>
                {(exam?.description || exam?.instructions) && (
                  <button
                    type="button"
                    onClick={() => setShowInstructionsModal(true)}
                    className="px-2 py-0.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    title={t('exam.viewInstructions')}
                  >
                    <span>ℹ️</span>
                    <span className="hidden sm:inline">{t('exam.viewInstructions')}</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-surface-400 mt-0.5">
                <span className="truncate max-w-[100px] sm:max-w-none">{exam?.subject}</span>
                <span>•</span>
                <span className="text-teal-400 font-semibold">{answeredCount}/{questions.length} {t('common.done')}</span>
              </div>
            </div>
          </div>

          {/* Countdown & Status */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Saving indicator */}
            <div className="hidden sm:flex items-center text-xs">
              {savingStatus === 'saving' && <span className="text-amber-400 animate-pulse font-medium">{t('exam.savingStatus')}</span>}
              {savingStatus === 'saved' && <span className="text-emerald-400 font-medium">{t('exam.savedStatus')}</span>}
              {savingStatus === 'error' && <span className="text-rose-400 font-medium">{t('exam.syncErrorStatus')}</span>}
            </div>

            {/* Question grid button for mobile header */}
            <button
              onClick={() => setShowNavSheet(true)}
              className="lg:hidden px-2.5 py-1.5 rounded-xl bg-surface-800 hover:bg-surface-700 text-teal-300 text-xs font-semibold border border-surface-700 flex items-center gap-1 min-h-[38px]"
              title={t('exam.openGrid')}
            >
              <span>🧭</span>
              <span className="hidden sm:inline">{t('exam.grid')}</span>
            </button>

            {/* Timer Badge */}
            <div
              className={`px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold border transition-colors flex items-center gap-1.5 ${
                isTimerCritical
                  ? 'bg-rose-950 text-rose-300 border-rose-700 animate-pulse shadow-lg shadow-rose-950/50'
                  : isThreeMinWarning
                  ? 'bg-rose-950 text-rose-200 border-rose-600 animate-pulse shadow-lg ring-2 ring-rose-500/50'
                  : isTimerLow
                  ? 'bg-amber-950 text-amber-300 border-amber-700'
                  : 'bg-surface-800 text-teal-400 border-surface-700'
              }`}
            >
              <span>{isThreeMinWarning ? '🚨' : '⏱️'}</span>
              <span>{formatTime(remainingSeconds)}</span>
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="hidden sm:flex p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 text-xs font-medium border border-surface-700 min-h-[38px] min-w-[38px] items-center justify-center"
              title={t('exam.toggleFullscreen')}
            >
              ⛶
            </button>

            {/* Language & Theme Controls */}
            <PreferencesControls className="hidden sm:inline-flex scale-90" />
          </div>
        </div>
      </header>

      {/* Prominent 3-Minute Warning Banner */}
      {isThreeMinWarning && (
        <div className="bg-gradient-to-r from-rose-950 via-amber-950 to-rose-950 border-b border-rose-700/80 px-4 py-2 text-center text-xs sm:text-sm font-bold text-rose-200 animate-pulse flex items-center justify-center gap-2 shadow-lg z-20">
          <span className="text-base animate-bounce">🚨</span>
          <span>{t('exam.threeMinWarningBanner')}</span>
          <span className="font-mono text-amber-300 font-extrabold underline shrink-0">({formatTime(remainingSeconds)})</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Question Panel (3 Columns) */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6 flex flex-col justify-between">
          {/* Question Card */}
          <div className="glass-card p-4 sm:p-6 md:p-8 rounded-2xl border border-surface-800 space-y-5 animate-fade-in flex-1">
            {/* Question Header */}
            <div className="flex items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-surface-800">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-lg bg-teal-950 border border-teal-800 text-teal-400 text-xs font-bold">
                  {t('exam.questionNumber', { number: currentIndex + 1 })} / {questions.length}
                </span>
                <span className="text-xs text-surface-400 font-medium">
                  ({t(currentQ?.marks === 1 ? 'exam.mark_one' : 'exam.mark_other', { count: currentQ?.marks || 0 })})
                </span>
              </div>

              {/* Flag button */}
              <button
                onClick={() => toggleFlag(currentQ._id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all min-h-[40px] ${
                  flagged.includes(currentQ._id)
                    ? 'bg-amber-950 text-amber-400 border-amber-700'
                    : 'bg-surface-800 text-surface-400 border-surface-700 hover:bg-surface-700'
                }`}
              >
                <span>🚩</span>
                <span>{flagged.includes(currentQ._id) ? t('exam.flagged') : t('exam.flag')}</span>
              </button>
            </div>

            {/* Question Text */}
            <div className={`text-base sm:text-lg md:text-xl font-semibold text-surface-100 leading-relaxed break-words ${detectScriptClass(currentQ?.text)}`} dir="auto">
              {currentQ?.text}
            </div>

            {/* Answer Inputs */}
            <div className="pt-2 space-y-3">
              {/* MCQ Single / True False */}
              {(currentQ?.type === 'mcq_single' || currentQ?.type === 'true_false') && (
                <div className="space-y-3">
                  {currentQ.options.map((opt) => {
                    const isSelected = answers[currentQ._id] === opt.id;
                    const optScriptClass = detectScriptClass(opt.text);
                    return (
                      <label
                        key={opt.id}
                        onClick={() => handleAnswerChange(currentQ._id, opt.id)}
                        className={`flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer min-h-[56px] ${
                          isSelected
                            ? 'bg-teal-950/70 border-teal-500 shadow-md shadow-teal-950/40 text-surface-100 ring-1 ring-teal-500/40'
                            : 'bg-surface-900/60 border-surface-800 hover:border-surface-700 text-surface-300'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs shrink-0 transition-colors ${
                            isSelected
                              ? 'border-teal-400 bg-teal-500 text-surface-950 font-bold'
                              : 'border-surface-600 bg-surface-800'
                          }`}
                        >
                          {isSelected && '✓'}
                        </div>
                        <span className={`text-base leading-relaxed break-words flex-1 ${optScriptClass}`} dir="auto">{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* MCQ Multi */}
              {currentQ?.type === 'mcq_multi' && (
                <div className="space-y-3">
                  <p className="text-xs text-teal-400 font-semibold mb-1">{t('exam.selectAllThatApply')}</p>
                  {currentQ.options.map((opt) => {
                    const currentList = Array.isArray(answers[currentQ._id]) ? answers[currentQ._id] : [];
                    const isSelected = currentList.includes(opt.id);
                    const optScriptClass = detectScriptClass(opt.text);

                    const toggleMulti = () => {
                      const updated = isSelected
                        ? currentList.filter((id) => id !== opt.id)
                        : [...currentList, opt.id];
                      handleAnswerChange(currentQ._id, updated);
                    };

                    return (
                      <label
                        key={opt.id}
                        onClick={toggleMulti}
                        className={`flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer min-h-[56px] ${
                          isSelected
                            ? 'bg-teal-950/70 border-teal-500 shadow-md shadow-teal-950/40 text-surface-100 ring-1 ring-teal-500/40'
                            : 'bg-surface-900/60 border-surface-800 hover:border-surface-700 text-surface-300'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs shrink-0 transition-colors ${
                            isSelected
                              ? 'border-teal-400 bg-teal-500 text-surface-950 font-bold'
                              : 'border-surface-600 bg-surface-800'
                          }`}
                        >
                          {isSelected && '✓'}
                        </div>
                        <span className={`text-base leading-relaxed break-words flex-1 ${optScriptClass}`} dir="auto">{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Short Answer */}
              {currentQ?.type === 'short_answer' && (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={answers[currentQ._id] || ''}
                    onChange={(e) => handleAnswerChange(currentQ._id, e.target.value)}
                    placeholder={t('exam.typeAnswerPlaceholder')}
                    className={`w-full p-4 rounded-xl bg-surface-900 border border-surface-700 text-surface-100 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-base leading-relaxed ${detectScriptClass(
                      answers[currentQ._id]
                    )}`}
                    dir="auto"
                  />
                  <p className="text-xs text-surface-500 text-right">
                    {t('exam.charTyped', { count: (answers[currentQ._id] || '').length })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Navigation Controls */}
          <div className="hidden lg:flex items-center justify-between gap-4 pt-2">
            <Button
              variant="outline"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-6 py-2.5 min-h-[44px]"
            >
              {t('exam.previous')}
            </Button>

            {currentIndex < questions.length - 1 ? (
              <Button
                variant="primary"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className="px-6 py-2.5 min-h-[44px]"
              >
                {t('exam.next')}
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={() => setShowSubmitModal(true)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold min-h-[44px]"
              >
                {t('exam.submitExam')}
              </Button>
            )}
          </div>
        </div>

        {/* Question Palette Sidebar (Desktop) */}
        <div className="hidden lg:block space-y-6">
          <div className="glass-card p-5 rounded-2xl border border-surface-800 space-y-4">
            {/* Student Info Box */}
            <div className="p-3 bg-teal-950/40 border border-teal-800/60 rounded-xl space-y-0.5">
              <div className="text-xs font-semibold text-teal-400">
                {t('exam.student')}
              </div>
              <div className="text-sm font-bold text-surface-100">
                {student?.fullName || t('exam.student')}
              </div>
              {student?.studentId && (
                <div className="text-xs font-mono text-surface-400" dir="ltr">
                  ID: {student.studentId}
                </div>
              )}
            </div>

            <h3 className="text-sm font-semibold text-surface-200">
              {t('exam.questionNavigator')}
            </h3>

            {/* Grid of questions */}
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered =
                  answers[q._id] !== undefined &&
                  answers[q._id] !== '' &&
                  (Array.isArray(answers[q._id]) ? answers[q._id].length > 0 : true);
                const isFlagged = flagged.includes(q._id);

                return (
                  <button
                    key={q._id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative h-10 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center border ${
                      isCurrent
                        ? 'border-teal-400 ring-2 ring-teal-500/40 bg-teal-950 text-teal-200'
                        : isFlagged
                        ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                        : isAnswered
                        ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                        : 'bg-surface-900 border-surface-800 text-surface-400 hover:bg-surface-800'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 text-xs">🚩</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-surface-800 space-y-2 text-xs text-surface-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-950 border border-emerald-800"></span>
                <span>{t('exam.answered')} ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-surface-900 border border-surface-800"></span>
                <span>{t('exam.unanswered')} ({unansweredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-amber-950 border border-amber-700"></span>
                <span>{t('exam.flagged')} ({flagged.length})</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowSubmitModal(true)}
              className="w-full mt-4 text-xs font-semibold py-2.5 border-teal-700/50 text-teal-300 hover:bg-teal-950 min-h-[44px]"
            >
              {t('exam.finishSubmit')}
            </Button>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Bar for Mobile (< 1024px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-surface-900/95 backdrop-blur-xl border-t border-surface-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2 shadow-2xl">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="flex-1 min-h-[44px] justify-center text-xs"
        >
          {t('exam.previous')}
        </Button>

        <button
          onClick={() => setShowNavSheet(true)}
          className="px-3 py-2.5 rounded-xl bg-surface-800 text-teal-300 border border-surface-700 font-bold text-xs flex items-center justify-center gap-1 min-h-[44px]"
        >
          <span>🧭</span>
          <span>{currentIndex + 1}/{questions.length}</span>
        </button>

        {currentIndex < questions.length - 1 ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            className="flex-1 min-h-[44px] justify-center text-xs font-bold"
          >
            {t('exam.next')}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowSubmitModal(true)}
            className="flex-1 min-h-[44px] justify-center text-xs bg-emerald-600 hover:bg-emerald-500 font-bold"
          >
            {t('exam.submitExam')}
          </Button>
        )}
      </div>

      {/* Question Navigator Mobile Bottom Sheet */}
      {showNavSheet && (
        <Modal
          isOpen={showNavSheet}
          onClose={() => setShowNavSheet(false)}
          title={t('exam.questionNavigator')}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2.5 max-h-[50dvh] overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered =
                  answers[q._id] !== undefined &&
                  answers[q._id] !== '' &&
                  (Array.isArray(answers[q._id]) ? answers[q._id].length > 0 : true);
                const isFlagged = flagged.includes(q._id);

                return (
                  <button
                    key={q._id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowNavSheet(false);
                    }}
                    className={`relative h-12 rounded-xl font-mono text-sm font-bold transition-all flex items-center justify-center border min-h-[44px] ${
                      isCurrent
                        ? 'border-teal-400 ring-2 ring-teal-500/40 bg-teal-950 text-teal-200'
                        : isFlagged
                        ? 'bg-amber-950/70 border-amber-700 text-amber-300'
                        : isAnswered
                        ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                        : 'bg-surface-900 border-surface-800 text-surface-400'
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 text-xs">🚩</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-surface-800 flex justify-between text-xs text-surface-400">
              <span className="text-emerald-400 font-semibold">{answeredCount} {t('exam.answered')}</span>
              <span className="text-amber-400 font-semibold">{flagged.length} {t('exam.flagged')}</span>
              <span className="text-surface-400 font-semibold">{unansweredCount} {t('exam.unanswered')}</span>
            </div>

            <Button
              variant="secondary"
              onClick={() => setShowNavSheet(false)}
              className="w-full justify-center min-h-[44px]"
            >
              {t('exam.closeNavigator')}
            </Button>
          </div>
        </Modal>
      )}

      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title={t('exam.confirmSubmitTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            {t('exam.confirmSubmitMessage')}
          </p>

          <div className="grid grid-cols-3 gap-3 p-4 bg-surface-900 rounded-xl text-center border border-surface-800">
            <div>
              <div className="text-xl font-bold text-surface-100">{questions.length}</div>
              <div className="text-xs text-surface-500">{t('common.all')}</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-400">{answeredCount}</div>
              <div className="text-xs text-emerald-500/80">{t('exam.answered')}</div>
            </div>
            <div>
              <div className={`text-xl font-bold ${unansweredCount > 0 ? 'text-rose-400' : 'text-surface-400'}`}>
                {unansweredCount}
              </div>
              <div className="text-xs text-surface-500">{t('exam.unanswered')}</div>
            </div>
          </div>

          {unansweredCount > 0 && (
            <div className="p-3 bg-amber-950/60 border border-amber-800/60 text-amber-300 text-xs rounded-xl flex items-center gap-2">
              <span>⚠️</span>
              <span>{t('exam.unansweredWarning', { count: unansweredCount })}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowSubmitModal(false)}>
              {t('exam.continueAnswering')}
            </Button>
            <Button
              variant="primary"
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold"
            >
              {submitting ? t('exam.submitting') : t('exam.yesSubmitNow')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Tab Switch Warning Modal */}
      <Modal
        isOpen={tabWarningModal}
        onClose={() => setTabWarningModal(false)}
        title={t('exam.tabSwitchTitle')}
      >
        <div className="space-y-4 text-start">
          <div className="p-4 bg-amber-950/70 border border-amber-700/80 rounded-2xl text-amber-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-amber-300">
                {t('exam.tabSwitchWarningCount', { count: tabSwitchCount })}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                {tabSwitchCount} / 3
              </span>
            </div>
            <p className="text-xs sm:text-sm leading-relaxed">
              {t('exam.tabSwitchMessage')}
            </p>
            <p className="text-xs font-semibold text-rose-300 pt-1">
              {t('exam.tabSwitchLimitNotice')}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" onClick={() => setTabWarningModal(false)}>
              {t('exam.understandReturn')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 3 Minutes Remaining Alert Modal */}
      <Modal
        isOpen={showThreeMinModal}
        onClose={() => setShowThreeMinModal(false)}
        title={t('exam.threeMinWarningTitle')}
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-950/80 border border-rose-700/80 rounded-2xl text-center space-y-2">
            <div className="text-3xl animate-bounce">⏳</div>
            <div className="font-mono text-2xl font-extrabold text-amber-300">
              {formatTime(remainingSeconds)}
            </div>
            <p className="text-xs sm:text-sm text-rose-200 font-medium leading-relaxed">
              {t('exam.threeMinWarningMessage')}
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              variant="primary"
              onClick={() => setShowThreeMinModal(false)}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
            >
              {t('exam.gotIt')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Exam Description & Instructions Modal */}
      {showInstructionsModal && (
        <Modal
          isOpen={showInstructionsModal}
          onClose={() => setShowInstructionsModal(false)}
          title={exam?.title || t('exam.viewInstructions')}
          size="md"
        >
          <div className="space-y-4">
            {exam?.description && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-teal-400">
                  {t('exam.examDescription')}
                </h4>
                <div className="p-3 bg-surface-900 border border-surface-800 rounded-xl text-sm text-surface-200 leading-relaxed whitespace-pre-wrap">
                  {exam.description}
                </div>
              </div>
            )}

            {exam?.instructions && (
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-teal-400">
                  {t('exam.examInstructions')}
                </h4>
                <div className="p-3 bg-surface-900 border border-surface-800 rounded-xl text-sm text-surface-200 leading-relaxed whitespace-pre-wrap">
                  {exam.instructions}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setShowInstructionsModal(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
