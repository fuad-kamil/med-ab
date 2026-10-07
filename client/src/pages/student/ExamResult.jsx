import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import api from '../../api/client';
import { Button } from '../../components/Button';
import PreferencesControls from '../../components/PreferencesControls';

export default function ExamResult() {
  const { t, i18n } = useTranslation();
  const { token: urlToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [downloadingDoc, setDownloadingDoc] = useState(false);

  const studentToken = sessionStorage.getItem('studentExamToken');
  const studentApiConfig = {
    headers: { Authorization: `Bearer ${studentToken}` },
  };

  const handleDownloadDocx = async () => {
    try {
      setDownloadingDoc(true);
      const targetLang = result?.examLanguage || i18n.language || 'en';
      const res = await api.get(`/api/student/result/download-doc?lang=${targetLang}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Exam_Report_${result?.examTitle || 'Attempt'}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download docx report:', err);
    } finally {
      setDownloadingDoc(false);
    }
  };

  useEffect(() => {
    const fetchResult = async () => {
      if (!studentToken) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const res = await api.get('/api/student/result', studentApiConfig);
        setResult(res.data);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || t('errors.GENERIC'));
      } finally {
        setLoading(false);
      }
    };
    fetchResult();
  }, [studentToken, t]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-950 text-surface-200">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-medium text-surface-400">{t('exam.fetchingResults')}</p>
        </div>
      </div>
    );
  }

  // If results not released or initial completion view
  if (!result || !result.resultsReleased) {
    return (
      <div className="min-h-[100dvh] relative flex items-center justify-center bg-surface-950 p-4 text-surface-100">
        <div className="absolute top-4 right-4 z-50">
          <PreferencesControls />
        </div>
        <div className="w-full max-w-lg glass-card p-8 rounded-2xl border border-surface-800 shadow-2xl text-center space-y-6 animate-slide-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-4xl shadow-lg shadow-emerald-950/50">
            🎉
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-surface-100">{t('exam.submittedTitle')}</h1>
            <p className="text-sm text-surface-400">
              {t('exam.recordedSuccess')}
            </p>
          </div>

          {result && (
            <div className="p-4 bg-surface-900 rounded-xl border border-surface-800 text-start space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-4">
                <span className="text-surface-500 shrink-0">{t('exams.examTitle')}:</span>
                <span className="font-semibold text-surface-200 truncate">{result.examTitle}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-surface-500 shrink-0">{t('results.category')}:</span>
                <span className="font-semibold text-surface-200 truncate">
                  {result.subject || t('common.uncategorized')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-surface-500 shrink-0">{t('results.submittedAt')}:</span>
                <span className="font-semibold text-surface-200" dir="ltr">
                  {result.submittedAt
                    ? new Date(result.submittedAt).toLocaleString(i18n.language, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '-'}
                </span>
              </div>
            </div>
          )}

          <div className="p-4 bg-teal-950/40 border border-teal-800/50 rounded-xl text-xs text-teal-300">
            ℹ️ {t('exam.detailedBreakdownNotice')}
          </div>

          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.removeItem('exam_access_token');
              sessionStorage.removeItem('studentExamToken');
              navigate('/exam');
            }}
            className="w-full"
          >
            {t('exam.backToEntrance')}
          </Button>
        </div>
      </div>
    );
  }

  // Results are released! Show rich score & breakdown
  const { examTitle, subject, score, totalMarks, percentage, passed, questions } = result;

  return (
    <div className="min-h-[100dvh] relative bg-surface-950 text-surface-100 p-4 md:p-8 font-sans">
      <div className="absolute top-4 right-4 z-50">
        <PreferencesControls />
      </div>
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pt-8 md:pt-4">
        {/* Result Header Card */}
        <div className="glass-card p-6 md:p-8 rounded-2xl border border-surface-800 text-center space-y-6 shadow-2xl">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-teal-400">{t('exam.scoreReport')}</span>
            <h1 className="font-sans text-2xl md:text-3xl font-bold text-surface-100">{examTitle}</h1>
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-surface-400">{subject}</span>
              {result?.examLanguage && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-950/80 text-teal-300 border border-teal-800">
                  🌐 {result.examLanguage === 'ar' ? 'العربية' : result.examLanguage === 'am' ? 'አማርኛ' : 'English'}
                </span>
              )}
            </div>
          </div>

          {/* Score Badge */}
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="inline-flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-900 border border-surface-800 shadow-inner space-y-1 w-full max-w-sm">
              <div className="text-[44px] font-bold text-teal-400 tabular-nums leading-none">
                {score} <span className="text-xl text-surface-500 font-normal">/ {totalMarks}</span>
              </div>
              <div className="text-base font-medium text-surface-300">
                {t('exam.scoreLabel', { percentage })}
              </div>
              <div
                className={`mt-2 px-4 py-1 rounded-full text-xs font-semibold border ${
                  passed
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                    : 'bg-rose-950 text-rose-300 border-rose-700'
                }`}
              >
                {passed ? t('exam.passed') : t('exam.failed')}
              </div>
            </div>

            {!result?.needsGrading && (
              <Button
                variant="secondary"
                onClick={handleDownloadDocx}
                disabled={downloadingDoc}
                className="w-full max-w-sm flex items-center justify-center gap-2 text-sm py-2.5 shadow-md"
              >
                <FileText className="w-4 h-4 text-teal-400" />
                <span>{downloadingDoc ? t('results.downloadingReportDocx') : t('results.downloadReportDocx')}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Detailed Question Review */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-surface-200">{t('exam.questionReview')}</h2>

          <div className="space-y-4">
            {questions.map((q, idx) => {
              const isShortAnswer = q.type === 'short_answer';
              const isCorrect = q.isCorrect;
              const studentAns = q.studentAnswer;
              const isGraded = q.isGradedByTeacher;

              let cardBgClass = 'bg-surface-900/40 border-surface-800';
              if (isShortAnswer) {
                cardBgClass = isGraded
                  ? 'bg-amber-950/15 border-amber-800/50'
                  : 'bg-surface-900/60 border-surface-700/60';
              } else if (isCorrect === true) {
                cardBgClass = 'bg-emerald-950/20 border-emerald-900/60';
              } else if (isCorrect === false) {
                cardBgClass = 'bg-rose-950/20 border-rose-900/60';
              }

              return (
                <div
                  key={q._id}
                  className={`p-6 rounded-2xl border transition-all ${cardBgClass}`}
                >
                  <div className="flex items-start justify-between gap-4 pb-3 border-b border-surface-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isShortAnswer ? (
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            isCorrect
                              ? 'bg-emerald-900 text-emerald-300'
                              : 'bg-rose-900 text-rose-300'
                          }`}
                        >
                          {isCorrect ? '✓' : '✕'}
                        </span>
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-amber-900/60 text-amber-300 flex items-center justify-center text-xs">
                          📝
                        </span>
                      )}
                      <span className="text-xs font-bold text-surface-400">
                        {t('exam.questionNumber', { number: idx + 1 })}
                      </span>

                      {isShortAnswer && (
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isGraded
                              ? 'bg-amber-900/40 border border-amber-700/50 text-amber-300'
                              : 'bg-surface-800 border border-surface-700 text-surface-300'
                          }`}
                        >
                          {isGraded
                            ? t('exam.gradedByUstaz')
                            : t('exam.pendingUstazReview')}
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-semibold text-surface-300 shrink-0">
                      {isShortAnswer && !isGraded
                        ? t('exam.maxMarks', { marks: q.marks })
                        : t('exam.earnedMarks', { earned: q.earnedMarks, marks: q.marks })}
                    </span>
                  </div>

                  <div className="pt-3 space-y-3">
                    <div className="text-sm md:text-base font-semibold text-surface-100">
                      {q.text}
                    </div>

                    {/* Student Answer */}
                    <div className="text-xs space-y-1">
                      <span className="text-surface-500 font-medium">{t('exam.yourAnswer')}</span>
                      <div
                        className={`p-3 rounded-xl border text-sm ${
                          isShortAnswer
                            ? 'bg-surface-900 border-surface-800 text-surface-200'
                            : isCorrect
                            ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                            : 'bg-rose-950/50 border-rose-800 text-rose-200'
                        }`}
                      >
                        {Array.isArray(studentAns)
                          ? studentAns.join(', ')
                          : studentAns || t('exam.noAnswerProvided')}
                      </div>
                    </div>

                    {/* Correct Answer for Choice / True-False questions only */}
                    {!isShortAnswer && !isCorrect && q.correctAnswer && (
                      <div className="text-xs space-y-1">
                        <span className="text-surface-500 font-medium">{t('exam.correctAnswer')}</span>
                        <div className="p-3 rounded-xl bg-surface-900 border border-surface-800 text-surface-200 text-sm">
                          {Array.isArray(q.correctAnswer)
                            ? q.correctAnswer.join(', ')
                            : String(q.correctAnswer)}
                        </div>
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="p-3 bg-teal-950/40 border border-teal-800/50 rounded-xl text-xs text-teal-300 space-y-1">
                        <span className="font-bold">{t('exam.explanation')}</span>
                        <p>{q.explanation}</p>
                      </div>
                    )}

                    {/* Teacher Feedback */}
                    {q.feedback && (
                      <div className="p-3 bg-amber-950/40 border border-amber-800/50 rounded-xl text-xs text-amber-300 space-y-1">
                        <span className="font-bold">{t('exam.ustazFeedback')}</span>
                        <p>{q.feedback}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          {!result?.needsGrading && (
            <Button
              variant="secondary"
              onClick={handleDownloadDocx}
              disabled={downloadingDoc}
              className="w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 text-teal-400" />
              <span>{downloadingDoc ? t('results.downloadingReportDocx') : t('results.downloadReportDocx')}</span>
            </Button>
          )}

          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.removeItem('studentExamToken');
              navigate(`/exam/${urlToken}`);
            }}
            className="w-full sm:w-auto"
          >
            {t('exam.exitExamPortal')}
          </Button>
        </div>
      </div>
    </div>
  );
}
