import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import { Button } from '../../components/Button';
import PreferencesControls from '../../components/PreferencesControls';
import { GraduationCap, Eye, EyeOff, AlertCircle, ShieldAlert } from 'lucide-react';

export default function StudentLogin() {
  const { t } = useTranslation();
  const { token: urlToken } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const loggedOutDueToTabSwitch = location.state?.loggedOutDueToTabSwitch;

  // Handle address bar token hiding: read URL token, store in sessionStorage, then clean address bar to /exam
  const [accessToken, setAccessToken] = useState(() => {
    if (urlToken) {
      sessionStorage.setItem('exam_access_token', urlToken.trim());
      // Clean URL immediately to /exam without token in address bar
      window.history.replaceState(null, '', '/exam');
      return urlToken.trim();
    }
    return sessionStorage.getItem('exam_access_token') || '';
  });

  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [examMeta, setExamMeta] = useState(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Clear inputs on mount & handles back-forward cache restore
  useEffect(() => {
    setStudentId('');
    setPassword('');

    const handlePageShow = () => {
      setStudentId('');
      setPassword('');
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // Fetch public exam metadata
  useEffect(() => {
    if (!accessToken) return;
    const fetchExamInfo = async () => {
      setLoadingMeta(true);
      try {
        const res = await api.get(`/api/exams/by-token/${accessToken}`);
        setExamMeta(res.data.exam);
        setError('');
      } catch (err) {
        setExamMeta(null);
        setError(err.response?.data?.error || t('exam.linkTerminatedSub'));
        sessionStorage.removeItem('exam_access_token');
        sessionStorage.removeItem('studentExamToken');
      } finally {
        setLoadingMeta(false);
      }
    };
    fetchExamInfo();
  }, [accessToken, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accessToken || !studentId || !password) {
      setError(t('errors.fillAllFields'));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await api.post('/api/student/login', {
        accessToken: accessToken.trim(),
        studentId: studentId.trim(),
        password: password.trim(),
      });

      if (res.data.alreadySubmitted) {
        if (res.data.token) {
          sessionStorage.setItem('studentExamToken', res.data.token);
          localStorage.setItem('studentExamToken', res.data.token);
        }
        navigate('/exam/result', {
          state: { message: res.data.message, status: res.data.status },
        });
        return;
      }

      // Save student exam token to sessionStorage & localStorage
      sessionStorage.setItem('studentExamToken', res.data.token);
      localStorage.setItem('studentExamToken', res.data.token);
      sessionStorage.setItem('studentMeta', JSON.stringify(res.data.student));

      // Navigate to clean active exam route /exam/take
      navigate('/exam/take');
    } catch (err) {
      setError(err.response?.data?.error || t('errors.authFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  // If no exam found or link is terminated
  if ((!accessToken || !examMeta) && !loadingMeta) {
    return (
      <div className="min-h-[100dvh] relative flex items-center justify-center p-4 sm:p-6 bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 transition-colors">
        <div className="absolute top-4 right-4 z-50">
          <PreferencesControls />
        </div>

        <div className="w-full max-w-md glass-card p-6 sm:p-8 rounded-2xl border border-rose-500/30 dark:border-rose-900/50 shadow-2xl text-center space-y-4 animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 mb-2">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
            {t('exam.linkTerminatedTitle')}
          </h2>
          <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
            {error || t('exam.linkTerminatedSub')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] relative flex items-center justify-center p-4 sm:p-6 bg-surface-950 text-surface-100 transition-colors">
      {/* Top Right Preferences */}
      <div className="absolute top-4 right-4 z-50">
        <PreferencesControls />
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600/20 border border-teal-500/30 text-teal-400 shadow-lg shadow-teal-900/20 mb-1">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-100">
            {t('common.appName')}
          </h1>
          <div className="font-arabic text-xl sm:text-2xl text-teal-400 text-center dir-rtl py-1 select-none" dir="rtl">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </div>
          <p className="text-xs text-surface-400">
            {t('exam.credentialsInstructions')}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-5 sm:p-6 rounded-2xl border border-surface-800 shadow-2xl space-y-5 animate-slide-up">
          {/* Target Exam Info Card */}
          {loadingMeta ? (
            <div className="p-3.5 bg-surface-800/40 rounded-xl text-center text-xs text-surface-400 animate-pulse">
              {t('exam.checkingLink')}
            </div>
          ) : examMeta ? (
            <div className="p-4 bg-teal-950/40 border border-teal-800/50 rounded-xl space-y-2">
              <div className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                {t('exam.targetExam')}
              </div>
              <div className="text-base font-bold text-surface-100">
                {examMeta.title}
              </div>
              {examMeta.description && (
                <div className="text-xs text-surface-300 bg-surface-900/60 p-2.5 rounded-lg border border-teal-900/40 leading-relaxed whitespace-pre-wrap">
                  {examMeta.description}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-surface-400 mt-1">
                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    examMeta.status === 'open'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}
                >
                  {t('exam.statusLabel', { status: t(`common.${examMeta.status}`) })}
                </span>
                {examMeta.durationMinutes && (
                  <span>{t('exam.durationMins', { mins: examMeta.durationMinutes })}</span>
                )}
              </div>
            </div>
          ) : null}

          {/* Logged Out Due to Tab Switch Warnings Banner */}
          {loggedOutDueToTabSwitch && (
            <div className="p-4 bg-rose-950/80 border border-rose-700/80 rounded-2xl space-y-1.5 text-start animate-fade-in shadow-lg">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs sm:text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{t('exam.tabSwitchLoggedOutTitle')}</span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">
                {t('exam.tabSwitchLoggedOutMessage')}
              </p>
            </div>
          )}

          <form id="student-exam-login-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Student ID Field */}
            <div className="space-y-1">
              <label htmlFor="student_id_field" className="block text-xs font-semibold text-surface-300 uppercase tracking-wider">
                {t('students.studentId')}
              </label>
              <input
                id="student_id_field"
                name="student_id_field"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder={t('students.studentIdPlaceholder')}
                required
                autoFocus
                autoComplete="off"
                className="w-full px-3.5 py-2.5 text-base rounded-xl bg-surface-900 border border-surface-700 text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label htmlFor="student_pass_field" className="block text-xs font-semibold text-surface-300 uppercase tracking-wider">
                {t('students.password')}
              </label>
              <div className="relative">
                <input
                  id="student_pass_field"
                  name="student_pass_field"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pr-10 text-base rounded-xl bg-surface-900 border border-surface-700 text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-teal-500 min-h-[44px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Inline Error Message */}
            {error && (
              <div className="p-3 bg-rose-950/60 border border-rose-800/60 text-rose-300 text-xs rounded-xl animate-fade-in flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              loading={submitting}
              disabled={submitting || (examMeta && examMeta.status !== 'open')}
              className="w-full min-h-[44px]"
              size="lg"
            >
              {submitting ? t('exam.authenticating') : t('students.enterExam')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
