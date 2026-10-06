import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api, { extractError } from '../../api/client';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';
import Toast from '../../components/Toast';
import { EmptyState, ErrorState, Badge, StatCard } from '../../components/Common';
import EmailResultButton from '../../components/EmailResultButton';
import {
  BarChart3,
  Download,
  Search,
  CheckCircle2,
  Clock,
  Award,
  Eye,
  RotateCcw,
  Save,
  User,
  RefreshCw,
  Filter,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  FileText,
  Trash2,
  Mail,
} from 'lucide-react';

export default function Results() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data
  const [summaries, setSummaries] = useState([]);
  const [categories, setCategories] = useState([]);

  // Filters
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Selected Exam Detailed Results
  const [examDetails, setExamDetails] = useState(null);
  const [loadingExamDetails, setLoadingExamDetails] = useState(false);

  // Selection & Batch Email
  const [selectedAttemptIds, setSelectedAttemptIds] = useState([]);
  const [batchEmailing, setBatchEmailing] = useState(false);

  // Delete Results Modal
  const [showDeleteResultsModal, setShowDeleteResultsModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingResults, setDeletingResults] = useState(false);

  // Attempt Detail Modal & Manual Teacher Grading
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [gradingScores, setGradingScores] = useState({}); // questionId -> marks
  const [gradingFeedback, setGradingFeedback] = useState({}); // questionId -> feedback
  const [savingGradeId, setSavingGradeId] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Question Card Refs for Jump Navigation
  const questionRefs = useRef({});

  // Reset Attempt State (Single student retake)
  const [resettingAttempt, setResettingAttempt] = useState(null);
  const [resetting, setResetting] = useState(false);

  // Toast
  const [toast, setToast] = useState(null);

  // Fetch summary & initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sumRes, catRes] = await Promise.all([
        api.get('/api/results/summary', { params: { categoryId: selectedCategoryId || undefined } }),
        api.get('/api/categories'),
      ]);
      setSummaries(sumRes.data?.summaries || []);
      setCategories(catRes.data?.categories || []);
    } catch (err) {
      setError(extractError(err, 'Failed to load results summary'));
    } finally {
      setLoading(false);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load specific exam details & student attempts
  const loadExamDetails = async (examId) => {
    setSelectedExamId(examId);
    setLoadingExamDetails(true);
    setSelectedAttemptIds([]);
    try {
      const res = await api.get(`/api/results/exam/${examId}`, {
        params: { search: searchQuery || undefined },
      });
      setExamDetails(res.data);
    } catch (err) {
      setToast({ message: extractError(err, 'Failed to load exam details').message, type: 'error' });
    } finally {
      setLoadingExamDetails(false);
    }
  };

  // Batch Email Results handler
  const handleBatchEmail = async () => {
    if (selectedAttemptIds.length === 0 || !selectedExamId) return;
    setBatchEmailing(true);
    try {
      const res = await api.post(`/api/results/exam/${selectedExamId}/email-batch`, {
        attemptIds: selectedAttemptIds,
        language: i18n.language,
      });
      setToast({
        message: `Batch email complete: ${res.data.sentCount || 0} sent, ${res.data.skippedCount || 0} skipped, ${res.data.failedCount || 0} failed.`,
        type: 'success',
      });
      setSelectedAttemptIds([]);
      loadExamDetails(selectedExamId);
    } catch (err) {
      setToast({ message: extractError(err, 'Failed to send batch emails').message, type: 'error' });
    } finally {
      setBatchEmailing(false);
    }
  };

  // Delete Selected Student Results handler
  const handleDeleteSelectedResults = async () => {
    if (selectedAttemptIds.length === 0) return;
    setDeletingResults(true);
    try {
      const res = await api.post('/api/results/attempts/delete-selected', {
        attemptIds: selectedAttemptIds,
      });
      setToast({ message: res.data.message || 'Selected student results deleted', type: 'success' });
      setShowDeleteResultsModal(false);
      setSelectedAttemptIds([]);
      if (selectedExamId) loadExamDetails(selectedExamId);
      fetchData();
    } catch (err) {
      setToast({ message: extractError(err, 'Failed to delete selected results').message, type: 'error' });
    } finally {
      setDeletingResults(false);
    }
  };

  // Open Attempt Detail Modal for Teacher Correction
  const openAttemptDetail = async (attemptId) => {
    setSelectedAttemptId(attemptId);
    setLoadingAttempt(true);
    setActiveQuestionIndex(0);
    setHasUnsavedChanges(false);
    try {
      const res = await api.get(`/api/results/attempt/${attemptId}`);
      const data = res.data; // { attempt, questions }
      setAttemptDetail(data);

      // Initialize grading input state
      const initialScores = {};
      const initialFeedback = {};
      if (Array.isArray(data.questions)) {
        data.questions.forEach((q) => {
          if (q.manualGrade && typeof q.manualGrade.marks === 'number') {
            initialScores[q._id] = q.manualGrade.marks;
            initialFeedback[q._id] = q.manualGrade.feedback || '';
          } else if (q.type === 'short_answer') {
            initialScores[q._id] = 0;
            initialFeedback[q._id] = '';
          } else if (q.isCorrect) {
            initialScores[q._id] = q.marks || 1;
            initialFeedback[q._id] = '';
          } else {
            initialScores[q._id] = 0;
            initialFeedback[q._id] = '';
          }
        });
      }
      setGradingScores(initialScores);
      setGradingFeedback(initialFeedback);
    } catch (err) {
      setToast({ message: extractError(err, 'Failed to load attempt details').message, type: 'error' });
      setSelectedAttemptId(null);
    } finally {
      setLoadingAttempt(false);
    }
  };

  // Handle Teacher Grade Submission for a single question
  const handleSaveGrade = async (questionId, marksOverride, feedbackOverride) => {
    setSavingGradeId(questionId);
    try {
      const marks = marksOverride !== undefined ? Number(marksOverride) : Number(gradingScores[questionId] || 0);
      const feedback = feedbackOverride !== undefined ? feedbackOverride : (gradingFeedback[questionId] || '');

      const res = await api.post(`/api/results/attempt/${selectedAttemptId}/grade/${questionId}`, {
        marks,
        feedback,
      });

      // 1. Immediately update input state
      setGradingScores((prev) => ({ ...prev, [questionId]: marks }));
      setGradingFeedback((prev) => ({ ...prev, [questionId]: feedback }));

      // 2. Immediately update in-memory attemptDetail questions & attempt scores
      if (attemptDetail) {
        setAttemptDetail((prev) => {
          if (!prev) return prev;
          const updatedQuestions = prev.questions.map((q) => {
            if (q._id === questionId) {
              const maxMarks = q.marks || 1;
              const isCorrect = marks === maxMarks;
              return {
                ...q,
                earnedMarks: marks,
                isCorrect: isCorrect,
                manualGrade: { marks, feedback },
              };
            }
            return q;
          });
          return {
            ...prev,
            attempt: res.data?.attempt || prev.attempt,
            questions: updatedQuestions,
          };
        });
      }

      setToast({ message: 'Teacher grade saved successfully', type: 'success' });
      setHasUnsavedChanges(false);
    } catch (err) {
      setToast({ message: extractError(err, 'Failed to save grade').message, type: 'error' });
    } finally {
      setSavingGradeId(null);
    }
  };

  // Refresh all data when done grading
  const handleDoneGrading = () => {
    setSelectedAttemptId(null);
    setAttemptDetail(null);
    if (selectedExamId) loadExamDetails(selectedExamId);
    fetchData();
    setToast({ message: 'All grades preserved', type: 'success' });
  };

  // Scroll to question helper
  const scrollToQuestion = (idx) => {
    setActiveQuestionIndex(idx);
    const el = questionRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  // Reset attempt (Allow single student retake)
  const handleResetAttempt = async () => {
    if (!resettingAttempt?.id) return;
    setResetting(true);
    try {
      await api.delete(`/api/results/attempt/${resettingAttempt.id}`);
      setToast({ message: 'Attempt reset successfully. Student can now retake this exam.', type: 'success' });
      const currentResetId = resettingAttempt.id;
      setResettingAttempt(null);
      if (selectedAttemptId === currentResetId) {
        setSelectedAttemptId(null);
      }
      if (selectedExamId) loadExamDetails(selectedExamId);
      fetchData();
    } catch (err) {
      setToast({ message: extractError(err, 'Failed to reset attempt').message, type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleAddExtraTime = async (examId, title) => {
    try {
      const { data } = await api.post(`/api/exams/${examId}/add-time`, { minutes: 5 });
      setToast({
        message: t('exams.addedFiveMinSuccess', { title: title || examDetails?.exam?.title || 'Exam' }),
        type: 'success',
      });
      if (selectedExamId === examId) {
        loadExamDetails(examId);
      }
      fetchData();
    } catch (err) {
      setToast({ message: extractError(err, 'Failed to add extra time').message, type: 'error' });
    }
  };

  const handleDownloadAttemptDocx = async (attemptId, studentName = 'Student') => {
    if (!attemptId) {
      setToast({ message: 'No attempt found to download report paper', type: 'error' });
      return;
    }
    try {
      const targetLang = examDetails?.exam?.language || i18n.language || 'en';
      const response = await api.get(`/api/results/attempt/${attemptId}/download-doc?lang=${targetLang}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Report_${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setToast({ message: t('results.downloadingReportDocx') || 'Downloading Word report paper...', type: 'info' });
    } catch (err) {
      console.error('Failed to download DOCX report:', err);
      setToast({ message: 'Failed to download Word report paper', type: 'error' });
    }
  };

  // Excel Export
  const handleExportExcel = (examId = '') => {
    const url = `${api.defaults.baseURL || ''}/api/results/export${examId ? `?examId=${examId}` : ''}`;
    const token = localStorage.getItem('token');

    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `results_${examId || 'all'}_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(() => {
        setToast({ message: 'Failed to download Excel export', type: 'error' });
      });
  };

  // Computed stats across summaries
  const totalSubmissions = summaries.reduce((acc, s) => acc + s.submitted, 0);
  const avgScoreAll = summaries.length > 0
    ? Math.round((summaries.reduce((acc, s) => acc + s.average, 0) / summaries.length) * 10) / 10
    : 0;
  const passRateAll = summaries.length > 0
    ? Math.round((summaries.reduce((acc, s) => acc + (s.passRate || 0), 0) / summaries.length) * 10) / 10
    : 0;

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error.message} code={error.code} onRetry={fetchData} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-primary-400" />
            {t('results.title')}
          </h1>
          <p className="text-xs sm:text-sm text-surface-400 mt-1">
            {t('results.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Button variant="secondary" size="sm" onClick={fetchData} className="min-h-[44px]">
            <RefreshCw className="w-4 h-4" />
            <span>{t('common.refresh')}</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleExportExcel(selectedExamId)} className="min-h-[44px]">
            <Download className="w-4 h-4" />
            <span>{t('results.exportExcel')}</span>
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards - Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          icon={<Award className="w-5 h-5 sm:w-6 sm:h-6 text-primary-400" />}
          label={t('results.totalExams')}
          value={summaries.length}
          color="primary"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 sm:w-6 sm:h-6 text-warning-400" />}
          label={t('results.totalSubmissions')}
          value={totalSubmissions}
          color="warning"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-success-400" />}
          label={t('results.averageScore')}
          value={`${avgScoreAll}%`}
          color="success"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-accent-400" />}
          label={t('results.passRate')}
          value={`${passRateAll}%`}
          color="primary"
        />
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-surface-400 shrink-0" />
          <select
            value={selectedCategoryId}
            onChange={(e) => {
              setSelectedCategoryId(e.target.value);
              setSelectedExamId('');
              setExamDetails(null);
            }}
            className="w-full sm:w-auto bg-surface-900 border border-surface-700 rounded-xl text-sm text-surface-200 px-3 py-2.5 focus:outline-none focus:border-primary-500 min-h-[44px]"
          >
            <option value="">{t('results.allCategories')}</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {selectedExamId && (
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-surface-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('results.searchStudent')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (selectedExamId) loadExamDetails(selectedExamId);
              }}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-surface-900 border border-surface-700 text-surface-200 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 min-h-[44px]"
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {selectedExamId && examDetails ? (
        /* Detailed Student Submissions Area for Selected Exam */
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              onClick={() => { setSelectedExamId(''); setExamDetails(null); setSelectedAttemptIds([]); }}
              className="text-xs sm:text-sm text-primary-400 hover:text-primary-300 hover:underline flex items-center gap-1 font-semibold min-h-[44px] py-1 cursor-pointer"
            >
              {t('results.backToAllExams')}
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedAttemptIds.length > 0 && (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleBatchEmail}
                    disabled={batchEmailing}
                    className="min-h-[40px]"
                  >
                    <Mail className="w-4 h-4" />
                    <span>{t('results.emailResult')} ({selectedAttemptIds.length})</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteResultsModal(true)}
                    className="min-h-[40px]"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{t('results.deleteResultsBtn')} ({selectedAttemptIds.length})</span>
                  </Button>
                </>
              )}
              <Button variant="secondary" size="sm" onClick={() => handleExportExcel(selectedExamId)} className="min-h-[40px]">
                <Download className="w-4 h-4" />
                <span>{t('results.exportExcel')}</span>
              </Button>
            </div>
          </div>

          <div className="glass-card p-4 sm:p-6 rounded-2xl border border-surface-800 bg-surface-900/80 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-surface-100">{examDetails.exam?.title}</h2>
                  {(examDetails.exam?.isDeleted || examDetails.isDeleted) && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                      {t('results.examDeletedBadge')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {examDetails.exam?.categoryName && (
                    <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-medium">
                      {examDetails.exam.categoryName}
                    </span>
                  )}
                  <Badge variant={examDetails.exam?.status === 'open' ? 'success' : 'default'}>
                    {t(`common.${examDetails.exam?.status}`)}
                  </Badge>
                </div>
              </div>
              <div>
                {!examDetails.exam?.isDeleted && (
                  <button
                    type="button"
                    onClick={() => handleAddExtraTime(selectedExamId, examDetails.exam?.title)}
                    title={t('exams.addFiveMinTooltip')}
                    className="h-[40px] px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>5+</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-4 pt-3 border-t border-surface-800/80 text-xs sm:text-sm">
              <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                <span className="text-surface-400 block text-[11px] font-medium">{t('results.totalSubmissions')}</span>
                <span className="text-surface-100 font-bold text-base sm:text-lg">{examDetails.results?.length || 0}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                <span className="text-surface-400 block text-[11px] font-medium">{t('results.passingMark')}</span>
                <span className="text-primary-400 font-bold text-base sm:text-lg">{examDetails.exam?.passMark || 'N/A'}%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                <span className="text-surface-400 block text-[11px] font-medium">{t('results.duration')}</span>
                <span className="text-surface-100 font-bold text-base sm:text-lg">{t('common.minutes_other', { count: examDetails.exam?.durationMinutes || 0 })}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-950/60 border border-surface-800">
                <span className="text-surface-400 block text-[11px] font-medium">{t('results.status')}</span>
                <span className={`font-bold text-base sm:text-lg ${examDetails.exam?.status === 'open' ? 'text-emerald-400' : 'text-surface-400'}`}>
                  {t(`common.${examDetails.exam?.status}`).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Submissions Section */}
          <div className="glass-card overflow-hidden rounded-2xl border border-surface-800 bg-surface-900/60 shadow-lg">
            <div className="p-4 border-b border-surface-800 font-bold text-surface-200 text-sm flex items-center justify-between">
              <span>{t('results.studentSubmissions', { count: examDetails.results?.length || 0 })}</span>
              {searchQuery && (
                <span className="text-xs font-normal text-surface-400">{t('results.filtering', { query: searchQuery })}</span>
              )}
            </div>

            {loadingExamDetails ? (
              <div className="py-12 flex justify-center">
                <Spinner size="md" />
              </div>
            ) : !examDetails.results || examDetails.results.length === 0 ? (
              <EmptyState title={t('results.noSubmissionsTitle')} message={t('results.noSubmissionsMessage')} />
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm text-surface-300">
                    <thead className="bg-surface-950/80 text-surface-400 uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3.5 w-10">
                          <input
                            type="checkbox"
                            checked={
                              examDetails.results.filter((a) => a.attemptId && a.status !== 'not_started' && !a.needsGrading).length > 0 &&
                              examDetails.results
                                .filter((a) => a.attemptId && a.status !== 'not_started' && !a.needsGrading)
                                .every((a) => selectedAttemptIds.includes(a.attemptId))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                const eligible = examDetails.results
                                  .filter((a) => a.attemptId && a.status !== 'not_started' && !a.needsGrading)
                                  .map((a) => a.attemptId);
                                setSelectedAttemptIds(eligible);
                              } else {
                                setSelectedAttemptIds([]);
                              }
                            }}
                            className="rounded border-surface-700 text-primary-500 focus:ring-primary-500 bg-surface-900 w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="px-6 py-3.5">{t('results.studentName')}</th>
                        <th className="px-6 py-3.5">{t('results.studentId')}</th>
                        <th className="px-6 py-3.5">{t('results.score')}</th>
                        <th className="px-6 py-3.5">{t('results.percentage')}</th>
                        <th className="px-6 py-3.5">{t('results.status')}</th>
                        <th className="px-6 py-3.5">{t('results.submittedAt')}</th>
                        <th className="px-6 py-3.5 text-right">{t('results.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-800/80">
                      {examDetails.results.map((att) => (
                        <tr key={att.attemptId || att.studentDbId} className="hover:bg-surface-800/40 transition-colors">
                          <td className="px-4 py-4 w-10">
                            <input
                              type="checkbox"
                              checked={selectedAttemptIds.includes(att.attemptId)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAttemptIds((prev) => [...prev, att.attemptId]);
                                } else {
                                  setSelectedAttemptIds((prev) => prev.filter((id) => id !== att.attemptId));
                                }
                              }}
                              disabled={!att.attemptId || att.status === 'not_started' || att.needsGrading}
                              className="rounded border-surface-700 text-primary-500 focus:ring-primary-500 bg-surface-900 w-4 h-4 cursor-pointer disabled:opacity-30"
                            />
                          </td>
                          <td className="px-6 py-4 font-semibold text-surface-100 flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary-600/20 text-primary-300 border border-primary-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                              {(att.studentName || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="truncate">{att.studentName}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-800 text-surface-300">
                              {att.studentId}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-surface-100">
                            {att.score !== null ? `${att.score} / ${att.totalMarks}` : 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            {att.percentage !== null ? (
                              <span className={att.passed ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                {att.percentage}%
                              </span>
                            ) : (
                              <span className="text-surface-500">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {att.status === 'not_started' ? (
                              <Badge variant="default">{t('results.notStarted')}</Badge>
                            ) : att.needsGrading ? (
                              <Badge variant="warning">{t('results.needsReview')}</Badge>
                            ) : att.passed ? (
                              <Badge variant="success">{t('results.passed')}</Badge>
                            ) : (
                              <Badge variant="danger">{t('results.failed')}</Badge>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-surface-400">
                            {att.submittedAt ? new Date(att.submittedAt).toLocaleString() : t('results.notSubmitted')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {att.attemptId && (
                                <>
                                  <button
                                    onClick={() => openAttemptDetail(att.attemptId)}
                                    className="px-3 py-1.5 rounded-xl bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 border border-primary-500/30 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                                    title={t('results.viewGradeAnswers')}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{t('results.grade')}</span>
                                  </button>

                                  <EmailResultButton
                                    attempt={att}
                                    studentEmail={att.studentEmail}
                                    onSentSuccess={(updatedEmail) => {
                                      setExamDetails((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              results: prev.results.map((r) =>
                                                r.attemptId === att.attemptId ? { ...r, resultEmail: updatedEmail } : r
                                              ),
                                            }
                                          : prev
                                      );
                                    }}
                                  />

                                  {!att.needsGrading && att.status !== 'not_started' && (
                                    <button
                                      onClick={() => handleDownloadAttemptDocx(att.attemptId, att.studentName)}
                                      className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                                      title={t('results.downloadReportDocx')}
                                    >
                                      <FileText className="w-3.5 h-3.5 text-teal-400" />
                                      <span>.docx</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      setResettingAttempt({
                                        id: att.attemptId,
                                        studentName: att.studentName,
                                        examTitle: examDetails.exam?.title,
                                      })
                                    }
                                    disabled={examDetails.exam?.isDeleted}
                                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={examDetails.exam?.isDeleted ? t('results.cannotRetakeDeletedTooltip') : t('results.allowRetakeTooltip')}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    <span>{t('results.retake')}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Stacked Cards View */}
                <div className="md:hidden divide-y divide-surface-800">
                  {examDetails.results.map((att) => (
                    <div key={att.attemptId || att.studentDbId} className="p-4 space-y-3 bg-surface-900/40">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-600 to-teal-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-md">
                            {(att.studentName || 'U').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-surface-100 text-sm truncate">{att.studentName}</div>
                            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-800 text-surface-400">
                              {att.studentId}
                            </span>
                          </div>
                        </div>
                        <div>
                          {att.status === 'not_started' ? (
                            <Badge variant="default">{t('results.notStarted')}</Badge>
                          ) : att.needsGrading ? (
                            <Badge variant="warning">{t('results.needsReview')}</Badge>
                          ) : att.passed ? (
                            <Badge variant="success">{t('results.passed')}</Badge>
                          ) : (
                            <Badge variant="danger">{t('results.failed')}</Badge>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-surface-950/80 text-xs border border-surface-800/80">
                        <div>
                          <span className="text-surface-500 block text-[10px]">{t('results.score')}</span>
                          <span className="font-bold text-surface-100">
                            {att.score !== null ? `${att.score} / ${att.totalMarks}` : 'N/A'}
                          </span>
                        </div>
                        <div>
                          <span className="text-surface-500 block text-[10px]">{t('results.percentage')}</span>
                          <span className={att.passed ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
                            {att.percentage !== null ? `${att.percentage}%` : '-'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-surface-500 block text-[10px]">{t('results.submittedAt')}</span>
                          <span className="text-surface-300 text-[11px]">
                            {att.submittedAt ? new Date(att.submittedAt).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {att.attemptId && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            onClick={() => openAttemptDetail(att.attemptId)}
                            className="py-2 px-2.5 rounded-xl bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 border border-primary-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer transition-colors shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{t('results.grade')}</span>
                          </button>

                          <EmailResultButton
                            attempt={att}
                            studentEmail={att.studentEmail}
                            onSentSuccess={(updatedEmail) => {
                              setExamDetails((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      results: prev.results.map((r) =>
                                        r.attemptId === att.attemptId ? { ...r, resultEmail: updatedEmail } : r
                                      ),
                                    }
                                  : prev
                              );
                            }}
                          />

                          {!att.needsGrading && att.status !== 'not_started' && (
                            <button
                              onClick={() => handleDownloadAttemptDocx(att.attemptId, att.studentName)}
                              className="py-2 px-2.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[11px] font-semibold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer transition-colors shadow-sm"
                            >
                              <FileText className="w-3.5 h-3.5 text-teal-400" />
                              <span>.docx</span>
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setResettingAttempt({
                                id: att.attemptId,
                                studentName: att.studentName,
                                examTitle: examDetails.exam?.title,
                              })
                            }
                            disabled={examDetails.exam?.isDeleted}
                            className="py-2 px-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-semibold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{t('results.retake')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Exams Summary Cards / Table View */
        <div className="glass-card overflow-hidden rounded-2xl border border-surface-800 bg-surface-900/60 shadow-lg">
          <div className="p-4 border-b border-surface-800 font-bold text-surface-200 text-sm flex items-center justify-between">
            <span>{t('results.examsSummary', { count: summaries.length })}</span>
            {selectedCategoryId && (
              <span className="text-xs font-normal text-primary-400">
                {t('results.filteredByCategory')}
              </span>
            )}
          </div>

          {summaries.length === 0 ? (
            <EmptyState title={t('results.noExamsTitle')} message={t('results.noExamsMessage')} />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm text-surface-300">
                  <thead className="bg-surface-950/80 text-surface-400 uppercase text-xs">
                    <tr>
                      <th className="px-6 py-3.5">{t('results.examTitle')}</th>
                      <th className="px-6 py-3.5">{t('results.category')}</th>
                      <th className="px-6 py-3.5">{t('results.eligible')}</th>
                      <th className="px-6 py-3.5">{t('results.submissions')}</th>
                      <th className="px-6 py-3.5">{t('results.avgScore')}</th>
                      <th className="px-6 py-3.5">{t('results.passRate')}</th>
                      <th className="px-6 py-3.5">{t('results.status')}</th>
                      <th className="px-6 py-3.5 text-right">{t('results.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800/80">
                    {summaries.map((exam) => (
                      <tr key={exam.examId} className="hover:bg-surface-800/40 transition-colors">
                        <td className="px-6 py-4 font-bold text-surface-100">{exam.title}</td>
                        <td className="px-6 py-4">
                          <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-xs font-medium">
                            {exam.categoryName || 'General'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-surface-300">{exam.eligible}</td>
                        <td className="px-6 py-4 font-medium text-surface-200">{exam.submitted}</td>
                        <td className="px-6 py-4 font-bold text-primary-400">{exam.average}%</td>
                        <td className="px-6 py-4 font-bold text-emerald-400">
                          {exam.passRate !== null ? `${exam.passRate}%` : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={exam.status === 'open' ? 'success' : 'default'}>
                            {t(`common.${exam.status}`)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="secondary" size="sm" onClick={() => loadExamDetails(exam.examId)}>
                            {t('results.viewSubmissions')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards View */}
              <div className="md:hidden divide-y divide-surface-800/80">
                {summaries.map((exam) => {
                  const pctSubmitted = exam.eligible > 0 ? Math.round((exam.submitted / exam.eligible) * 100) : 0;
                  return (
                    <div key={exam.examId} className="p-4 space-y-3.5 bg-surface-900/40 hover:bg-surface-800/30 transition-colors">
                      {/* Card Header: Title, Category Badge, Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-surface-100 text-base leading-snug">{exam.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-300 text-[11px] font-semibold">
                              🏷️ {exam.categoryName || 'General'}
                            </span>
                          </div>
                        </div>
                        <Badge variant={exam.status === 'open' ? 'success' : 'default'} className="shrink-0">
                          {t(`common.${exam.status}`)}
                        </Badge>
                      </div>

                      {/* Submissions Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-surface-400 font-medium">
                          <span>{t('results.submissions')} ({exam.submitted} / {exam.eligible})</span>
                          <span className="text-surface-200 font-semibold">{pctSubmitted}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-950 overflow-hidden border border-surface-800">
                          <div
                            className="h-full bg-gradient-to-r from-primary-600 to-teal-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(pctSubmitted, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats Grid Pill */}
                      <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-surface-950/80 border border-surface-800">
                        <div>
                          <span className="text-surface-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">{t('results.avgScore')}</span>
                          <span className="font-extrabold text-primary-400 text-sm">{exam.average}%</span>
                        </div>
                        <div>
                          <span className="text-surface-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">{t('results.passRate')}</span>
                          <span className="font-extrabold text-emerald-400 text-sm">
                            {exam.passRate !== null ? `${exam.passRate}%` : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <Button
                        variant="secondary"
                        onClick={() => loadExamDetails(exam.examId)}
                        className="w-full justify-center min-h-[44px] text-xs font-bold gap-2 bg-surface-800 hover:bg-surface-700 text-surface-100 border border-surface-700 cursor-pointer shadow-md"
                      >
                        <span>{t('results.viewSubmissions')}</span>
                        <span>→</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Upgraded Mobile-Responsive Teacher Correction Modal */}
      {selectedAttemptId && (
        <Modal
          isOpen={!!selectedAttemptId}
          onClose={() => {
            if (hasUnsavedChanges && !window.confirm(t('common.unsavedWarning'))) {
              return;
            }
            handleDoneGrading();
          }}
          title={t('results.teacherGradingTitle')}
          size="lg"
          footer={
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
              <span className="text-xs text-surface-400 hidden sm:inline">
                {t('results.questionTotal', { count: attemptDetail?.questions?.length || 0 })}
              </span>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (hasUnsavedChanges && !window.confirm(t('common.unsavedWarning'))) {
                      return;
                    }
                    handleDoneGrading();
                  }}
                  className="flex-1 sm:flex-none min-h-[44px]"
                >
                  {t('common.close')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDoneGrading}
                  className="flex-1 sm:flex-none min-h-[44px]"
                >
                  {t('results.doneGrading')}
                </Button>
              </div>
            </div>
          }
        >
          {loadingAttempt || !attemptDetail ? (
            <div className="py-12 flex justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Submission Header Card */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-surface-900/70 border border-surface-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-surface-100 text-sm sm:text-base flex items-center gap-2">
                      <User className="w-4 h-4 text-primary-400 shrink-0" />
                      <span>{attemptDetail.attempt?.student?.fullName}</span>
                      <span className="text-xs font-normal text-surface-400">({attemptDetail.attempt?.student?.studentId})</span>
                    </div>
                    <div className="text-xs text-surface-400 mt-0.5">
                      {t('exams.examTitle')}: <strong className="text-surface-200">{attemptDetail.attempt?.exam?.title}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <EmailResultButton
                      attempt={attemptDetail.attempt}
                      studentEmail={attemptDetail.attempt?.student?.email}
                      onSentSuccess={(updatedEmail) => {
                        setAttemptDetail((prev) => (prev ? { ...prev, attempt: { ...prev.attempt, resultEmail: updatedEmail } } : prev));
                      }}
                    />
                    {!attemptDetail.attempt?.needsGrading && (
                      <button
                        type="button"
                        onClick={() => handleDownloadAttemptDocx(attemptDetail.attempt?._id, attemptDetail.attempt?.student?.fullName)}
                        className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title={t('results.downloadReportDocx')}
                      >
                        <FileText className="w-4 h-4 text-teal-400" />
                        <span>{t('results.downloadReportDocx')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Score Summary Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-800 text-center">
                  <div className="p-2 rounded-lg bg-surface-950/60 border border-surface-800/80">
                    <div className="text-[10px] uppercase font-bold text-surface-500">{t('results.score')}</div>
                    <div className="text-sm sm:text-base font-bold text-primary-400">
                      {attemptDetail.attempt?.score} / {attemptDetail.attempt?.totalMarks}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-950/60 border border-surface-800/80">
                    <div className="text-[10px] uppercase font-bold text-surface-500">{t('results.percentage')}</div>
                    <div className={`text-sm sm:text-base font-bold ${attemptDetail.attempt?.passed ? 'text-success-400' : 'text-danger-400'}`}>
                      {attemptDetail.attempt?.percentage}%
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-surface-950/60 border border-surface-800/80 flex flex-col justify-center items-center">
                    <div className="text-[10px] uppercase font-bold text-surface-500 mb-0.5">{t('results.status')}</div>
                    {attemptDetail.attempt?.needsGrading ? (
                      <Badge variant="warning">{t('results.needsReview')}</Badge>
                    ) : attemptDetail.attempt?.passed ? (
                      <Badge variant="success">{t('results.passed')}</Badge>
                    ) : (
                      <Badge variant="danger">{t('results.failed')}</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Sticky Question Navigator Mini-Bar */}
              <div className="sticky top-0 z-20 bg-surface-900/95 backdrop-blur-md p-2 rounded-xl border border-surface-800 shadow-md flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none max-w-[calc(100%-110px)]">
                  {attemptDetail.questions?.map((q, idx) => {
                    const isShortAnswer = q.type === 'short_answer';
                    const manual = q.manualGrade;
                    const isCorrect = q.isCorrect;

                    let stateBg = 'bg-surface-800 text-surface-300 border-surface-700';
                    if (isShortAnswer) {
                      stateBg = manual && typeof manual.marks === 'number'
                        ? (manual.marks === q.marks ? 'bg-emerald-900/60 text-emerald-300 border-emerald-700' : manual.marks === 0 ? 'bg-rose-900/60 text-rose-300 border-rose-700' : 'bg-amber-900/50 text-amber-300 border-amber-700')
                        : 'bg-warning-500/30 text-warning-300 border-warning-500';
                    } else if (isCorrect) {
                      stateBg = 'bg-success-900/40 text-success-300 border-success-700';
                    } else {
                      stateBg = 'bg-danger-900/40 text-danger-300 border-danger-700';
                    }

                    return (
                      <button
                        key={q._id}
                        type="button"
                        onClick={() => scrollToQuestion(idx)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold border shrink-0 flex items-center justify-center transition-all ${stateBg} ${
                          activeQuestionIndex === idx ? 'ring-2 ring-primary-500 scale-110' : ''
                        }`}
                        title={t('results.jumpToQuestion', { number: idx + 1 })}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => scrollToQuestion(Math.max(0, activeQuestionIndex - 1))}
                    disabled={activeQuestionIndex === 0}
                    className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 disabled:opacity-40 text-surface-200 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title={t('exam.previous')}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToQuestion(Math.min((attemptDetail.questions?.length || 1) - 1, activeQuestionIndex + 1))}
                    disabled={activeQuestionIndex === (attemptDetail.questions?.length || 1) - 1}
                    className="p-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 disabled:opacity-40 text-surface-200 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                    title={t('exam.next')}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Questions Correction Cards */}
              <div className="space-y-4">
                {attemptDetail.questions?.map((q, idx) => {
                  const isShortAnswer = q.type === 'short_answer';
                  const manual = q.manualGrade;
                  const maxMarks = q.marks || 1;
                  const currentScore = gradingScores[q._id] !== undefined ? Number(gradingScores[q._id]) : (manual ? manual.marks : undefined);

                  // Dynamic Card Background & Border Style
                  let cardStyle = 'bg-surface-900/40 border-surface-800';
                  const earned = currentScore !== undefined ? currentScore : (manual ? manual.marks : (q.isCorrect ? maxMarks : (q.isCorrect === false ? 0 : undefined)));

                  if (earned !== undefined) {
                    if (earned === maxMarks || q.isCorrect === true) {
                      cardStyle = 'bg-emerald-950/40 border-emerald-800/80 ring-1 ring-emerald-500/30 text-emerald-100';
                    } else if (earned === 0 || q.isCorrect === false) {
                      cardStyle = 'bg-rose-950/40 border-rose-800/80 ring-1 ring-rose-500/30 text-rose-100';
                    } else {
                      cardStyle = 'bg-amber-950/40 border-amber-800/80 ring-1 ring-amber-500/30 text-amber-100';
                    }
                  } else if (isShortAnswer && !manual) {
                    cardStyle = 'bg-amber-950/40 border-amber-800/80 ring-1 ring-amber-500/30';
                  }

                  return (
                    <div
                      key={q._id}
                      ref={(el) => (questionRefs.current[idx] = el)}
                      className={`p-4 rounded-xl border space-y-3 transition-all scroll-mt-20 ${cardStyle}`}
                    >
                      {/* Question Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-surface-800">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-7 h-7 rounded-lg bg-surface-800 text-surface-200 font-bold text-xs flex items-center justify-center">
                            Q{idx + 1}
                          </span>
                          <Badge variant="default" className="text-[11px]">
                            {q.type === 'short_answer'
                              ? t('exams.shortAnswer')
                              : q.type === 'true_false'
                              ? t('exams.trueFalse')
                              : t('exams.mcqSingle')}
                          </Badge>
                        </div>
                        <Badge variant="primary" className="text-[11px]">
                          {q.marks} {t('exams.points')}
                        </Badge>
                      </div>

                      {/* Question Text */}
                      <div className="text-sm sm:text-base font-semibold text-surface-100 break-words leading-relaxed" dir="auto">
                        {q.text}
                      </div>

                      {/* Options List for Choice / T-F */}
                      {(q.type === 'mcq_single' || q.type === 'mcq_multi' || q.type === 'true_false') && (
                        <div className="space-y-2 pt-1 text-xs">
                          {q.options?.map((opt) => {
                            const isStudentSelected =
                              Array.isArray(q.studentAnswer)
                                ? q.studentAnswer.includes(opt.id)
                                : String(q.studentAnswer) === String(opt.id);
                            const isCorrectOpt =
                              Array.isArray(q.correctAnswer)
                                ? q.correctAnswer.includes(opt.id)
                                : String(q.correctAnswer) === String(opt.id);

                            return (
                              <div
                                key={opt.id}
                                className={`p-3 rounded-xl border space-y-1.5 ${
                                  isCorrectOpt
                                    ? 'bg-success-600/10 border-success-600/50 text-success-300 font-medium'
                                    : isStudentSelected
                                    ? 'bg-danger-600/10 border-danger-600/50 text-danger-300'
                                    : 'bg-surface-950/40 border-surface-800 text-surface-300'
                                }`}
                              >
                                <div className="text-sm break-words" dir="auto">
                                  {opt.text}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  {isCorrectOpt && (
                                    <span className="inline-flex items-center gap-1 font-bold text-success-400 bg-success-950/60 px-2 py-0.5 rounded border border-success-800">
                                      {t('results.correctChoice')}
                                    </span>
                                  )}
                                  {isStudentSelected && (
                                    <span className="inline-flex items-center gap-1 font-semibold text-surface-200 bg-surface-800 px-2 py-0.5 rounded border border-surface-700">
                                      {t('results.studentSelected')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Display Student Answer for Short Answer */}
                      {isShortAnswer && (
                        <div className="space-y-1.5 pt-1 text-xs">
                          <span className="text-surface-400 font-semibold block">{t('results.studentAnswer')}</span>
                          <div className="p-3 rounded-xl bg-surface-950 border border-surface-800 text-surface-100 text-sm whitespace-pre-wrap break-words leading-relaxed">
                            {q.studentAnswer ? (
                              q.studentAnswer
                            ) : (
                              <span className="italic text-surface-500">{t('results.noAnswerSubmitted')}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Full-width Touch-friendly Teacher Grading Controls */}
                      <div className="pt-3 border-t border-surface-800 space-y-3">
                        {/* Quick Correction 2-Button Row */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const fullMarks = q.marks || 1;
                              setGradingScores((prev) => ({ ...prev, [q._id]: fullMarks }));
                              setHasUnsavedChanges(true);
                              handleSaveGrade(q._id, fullMarks, gradingFeedback[q._id]);
                            }}
                            disabled={savingGradeId === q._id}
                            className="py-2.5 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/40 font-bold flex items-center justify-center gap-1.5 text-xs min-h-[44px] transition-colors cursor-pointer"
                          >
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span>{t('results.correctPts', { pts: q.marks })}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setGradingScores((prev) => ({ ...prev, [q._id]: 0 }));
                              setHasUnsavedChanges(true);
                              handleSaveGrade(q._id, 0, gradingFeedback[q._id]);
                            }}
                            disabled={savingGradeId === q._id}
                            className="py-2.5 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40 font-bold flex items-center justify-center gap-1.5 text-xs min-h-[44px] transition-colors cursor-pointer"
                          >
                            <X className="w-4 h-4 text-rose-400" />
                            <span>{t('results.incorrectZero')}</span>
                          </button>
                        </div>

                        {/* Custom Score & Feedback Row */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-surface-400 shrink-0 font-medium">{t('results.customScore')}</label>
                            <input
                              type="number"
                              min="0"
                              max={q.marks}
                              step="0.5"
                              inputMode="decimal"
                              value={gradingScores[q._id] ?? 0}
                              onChange={(e) => {
                                setHasUnsavedChanges(true);
                                setGradingScores({ ...gradingScores, [q._id]: e.target.value });
                              }}
                              className="w-20 px-3 py-2 text-sm rounded-xl bg-surface-950 border border-surface-700 text-surface-100 focus:outline-none focus:border-primary-500 text-center font-bold min-h-[44px]"
                            />
                            <span className="text-xs text-surface-400 shrink-0 font-medium">/ {q.marks}</span>
                          </div>

                          <input
                            type="text"
                            placeholder={t('results.feedbackOptional')}
                            value={gradingFeedback[q._id] || ''}
                            onChange={(e) => {
                              setHasUnsavedChanges(true);
                              setGradingFeedback({ ...gradingFeedback, [q._id]: e.target.value });
                            }}
                            className="flex-1 px-3 py-2 text-xs rounded-xl bg-surface-950 border border-surface-700 text-surface-200 placeholder:text-surface-500 focus:outline-none focus:border-primary-500 min-h-[44px]"
                          />

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSaveGrade(q._id)}
                            disabled={savingGradeId === q._id}
                            className="min-h-[44px] shrink-0 justify-center"
                          >
                            <Save className="w-4 h-4" />
                            <span>{t('results.saveScore')}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Reset Attempt / Retake Confirmation Modal */}
      {resettingAttempt && (
        <Modal
          isOpen={!!resettingAttempt}
          onClose={() => setResettingAttempt(null)}
          title={t('results.retakeConfirmTitle')}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-surface-300 leading-relaxed">
              {t('results.retakeConfirmMessage', { studentName: resettingAttempt.studentName, examTitle: resettingAttempt.examTitle })}
            </p>
            <p className="text-xs text-warning-400 bg-warning-500/10 p-3 rounded-xl border border-warning-500/20 leading-relaxed">
              {t('results.retakeWarning')}
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-surface-800">
              <Button variant="secondary" onClick={() => setResettingAttempt(null)} className="min-h-[44px]">
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={handleResetAttempt} disabled={resetting} className="min-h-[44px]">
                {resetting ? <Spinner size="sm" /> : t('results.resetRetakeBtn')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Selected Exam Results Confirmation Modal */}
      {showDeleteResultsModal && (
        <Modal
          isOpen={showDeleteResultsModal}
          onClose={() => setShowDeleteResultsModal(false)}
          title={`Delete ${selectedAttemptIds.length} Selected Student Result(s)`}
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-sm text-surface-300 leading-relaxed">
              Are you sure you want to delete results for the <strong>{selectedAttemptIds.length} selected student(s)</strong>? Their submission scores and attempt history will be permanently removed.
            </p>
            <p className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20 font-semibold leading-relaxed">
              ⚠ This action cannot be undone.
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2.5 pt-3 border-t border-surface-800">
              <Button
                variant="secondary"
                onClick={() => setShowDeleteResultsModal(false)}
                className="min-h-[44px]"
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteSelectedResults}
                disabled={deletingResults}
                className="min-h-[44px]"
              >
                {deletingResults ? <Spinner size="sm" /> : `Delete (${selectedAttemptIds.length})`}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
