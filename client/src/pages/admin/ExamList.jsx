import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import Button from '../../components/Button';
import { Modal, ConfirmDialog } from '../../components/Modal';
import Spinner, { LoadingScreen } from '../../components/Spinner';
import { ErrorState, Badge, ActionRow, MenuButton, StatusChip } from '../../components/Common';
import Toast from '../../components/Toast';
import { formatDate, formatDurationMinutes } from '../../utils/formatters';
import { normalizeForSearch, matchSearchQuery } from '../../utils/searchUtils';
import {
  FileText,
  Plus,
  Search,
  X,
  Filter,
  MoreVertical,
  Link as LinkIcon,
  Copy,
  Download,
  Trash2,
  Edit3,
  Lock,
  Clock,
  HelpCircle,
  Users,
  Award,
  Share2,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  AlertTriangle,
  ExternalLink,
  CheckCircle,
  CheckCircle2,
} from 'lucide-react';

/* ==========================================================================
   HELPER: PORTALED EXAM CARD "⋯" MENU
   ========================================================================== */
function ExamCardMenu({
  exam,
  onDuplicate,
  onDownloadWord,
  onRegenerateLink,
  onDelete,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const toggleMenu = (e) => {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 208; // w-52
      let left = rect.right - menuWidth;
      const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
      left = Math.max(8, Math.min(left, maxLeft));

      let top = rect.bottom + 6;
      if (top + 200 > window.innerHeight) {
        top = Math.max(10, rect.top - 200);
      }
      setCoords({ top, left });
    }
    setOpen((prev) => !prev);
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function handleScrollOrResize() {
      if (open) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800/80 border border-surface-700/60 transition-colors cursor-pointer flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary-500 outline-none"
        aria-label="Exam Options"
        aria-expanded={open}
        title="More actions"
      >
        <MoreVertical className="w-5 h-5" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ position: 'fixed', top: `${coords.top}px`, left: `${coords.left}px` }}
            className="w-52 rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl py-1.5 z-[9999] text-xs animate-scale-in space-y-0.5 text-surface-100 font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Duplicate Exam */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDuplicate();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-surface-800 text-left transition-colors cursor-pointer font-medium text-surface-200 hover:text-surface-100"
            >
              <Copy className="w-4 h-4 text-surface-400 shrink-0" />
              <span>{t('exams.duplicateExam')}</span>
            </button>

            {/* Download Word Document */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDownloadWord();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-surface-800 text-left transition-colors cursor-pointer font-medium text-surface-200 hover:text-surface-100"
            >
              <Download className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{t('exams.downloadWord')}</span>
            </button>

            {/* Regenerate Link */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onRegenerateLink();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-amber-950/30 text-amber-400 text-left transition-colors cursor-pointer font-medium"
            >
              <RefreshCw className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{t('exams.regenerateLink')}</span>
            </button>

            <div className="border-t border-surface-800 my-1" />

            {/* Delete Exam */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onDelete();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-rose-950/40 text-rose-400 text-left transition-colors cursor-pointer font-medium"
            >
              <Trash2 className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{t('exams.deleteExam')}</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}

/* ==========================================================================
   EXTEND TIME DIALOG COMPONENT
   ========================================================================== */
function ExtendTimeDialog({ isOpen, onClose, exam, onSuccess }) {
  const { t } = useTranslation();
  const [minutes, setMinutes] = useState(5);
  const [scope, setScope] = useState('all'); // 'all' | 'selected'
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch in-progress students when modal opens
  useEffect(() => {
    if (isOpen && exam?._id) {
      setLoadingStudents(true);
      setError('');
      api
        .get(`/api/exams/${exam._id}/in-progress-students`)
        .then((res) => {
          const list = res.data?.students || [];
          setStudents(list);
          setSelectedStudentIds(list.map((s) => s.studentObjectId));
        })
        .catch((err) => {
          console.error('Failed to load in-progress students', err);
        })
        .finally(() => setLoadingStudents(false));
    }
  }, [isOpen, exam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!exam) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        minutes: Number(minutes) || 5,
        studentIds: scope === 'selected' ? selectedStudentIds : undefined,
      };
      const res = await api.post(`/api/exams/${exam._id}/add-time`, payload);
      onSuccess(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || t('errors.GENERIC'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!exam) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('exams.extendTimeDialogTitle')}
      description={t('exams.extendTimeDescription')}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || (scope === 'selected' && selectedStudentIds.length === 0)}
          >
            {submitting ? t('common.loading') : t('common.confirm')}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-surface-200">
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Minutes Presets & Custom */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-surface-300">
            {t('exams.customMinutes')}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  minutes === m
                    ? 'bg-teal-600 text-white border-teal-500 shadow-md'
                    : 'bg-surface-800/80 border-surface-700 text-surface-300 hover:bg-surface-800'
                }`}
              >
                +{m}m
              </button>
            ))}
            <input
              type="number"
              min="1"
              max="180"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
              className="py-2 px-3 rounded-xl bg-surface-900 border border-surface-700 text-surface-100 text-xs font-bold text-center focus:border-teal-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Active Students Counter Banner */}
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold">
              {t('exams.inProgressCountLabel', { count: students.length })}
            </span>
          </div>
        </div>

        {/* Scope Choice */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-surface-300">Scope Choice</label>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 cursor-pointer hover:border-surface-700">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                className="text-teal-500 focus:ring-teal-500"
              />
              <div className="text-xs">
                <p className="font-bold text-surface-100">
                  {t('exams.scopeAll', { count: students.length })}
                </p>
                <p className="text-surface-400 text-[11px]">
                  Extends duration for exam and active student timers.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl bg-surface-900 border border-surface-800 cursor-pointer hover:border-surface-700">
              <input
                type="radio"
                name="scope"
                value="selected"
                checked={scope === 'selected'}
                onChange={() => setScope('selected')}
                className="text-teal-500 focus:ring-teal-500"
              />
              <div className="text-xs">
                <p className="font-bold text-surface-100">{t('exams.scopeSelected')}</p>
                <p className="text-surface-400 text-[11px]">
                  Pick specific in-progress students to grant extra time.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Selected Students Selection Checklist */}
        {scope === 'selected' && (
          <div className="space-y-2 border-t border-surface-800 pt-3">
            <div className="flex items-center justify-between text-xs text-surface-400">
              <span>Select Students ({selectedStudentIds.length} chosen)</span>
              <button
                type="button"
                onClick={() =>
                  setSelectedStudentIds(
                    selectedStudentIds.length === students.length
                      ? []
                      : students.map((s) => s.studentObjectId)
                  )
                }
                className="text-teal-400 hover:underline font-medium cursor-pointer"
              >
                {selectedStudentIds.length === students.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {loadingStudents ? (
              <p className="text-xs text-surface-500 py-4 text-center">{t('common.loading')}</p>
            ) : students.length === 0 ? (
              <p className="text-xs text-surface-500 py-3 text-center">
                {t('exams.noStudentsInProgress')}
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {students.map((st) => {
                  const isChecked = selectedStudentIds.includes(st.studentObjectId);
                  return (
                    <label
                      key={st.attemptId}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-teal-950/40 border-teal-800 text-surface-100'
                          : 'bg-surface-900 border-surface-800 text-surface-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStudentIds((prev) => [...prev, st.studentObjectId]);
                            } else {
                              setSelectedStudentIds((prev) =>
                                prev.filter((id) => id !== st.studentObjectId)
                              );
                            }
                          }}
                          className="rounded text-teal-500 focus:ring-teal-500"
                        />
                        <span className="font-semibold truncate">{st.fullName}</span>
                        {st.studentCode && (
                          <span className="text-[10px] text-surface-500">({st.studentCode})</span>
                        )}
                      </div>
                      <span className="text-[10px] text-surface-500 shrink-0">
                        Started: {new Date(st.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}

/* ==========================================================================
   CLOSE LINK CONFIRMATION DIALOG
   ========================================================================== */
function CloseLinkModal({ isOpen, onClose, exam, onConfirm }) {
  const { t } = useTranslation();
  const [closeAction, setCloseAction] = useState('block_new');
  const [submitting, setSubmitting] = useState(false);

  if (!exam) return null;

  const inProgressCount = exam.inProgressCount || 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('exams.closeLinkOptionsTitle')}
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              setSubmitting(true);
              await onConfirm(closeAction);
              setSubmitting(false);
              onClose();
            }}
            disabled={submitting}
          >
            {submitting ? t('common.loading') : t('exams.closedStatus')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-surface-200">
        <p className="text-xs text-surface-300">
          How would you like to close access to <strong className="text-surface-100">{exam.title}</strong>?
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-900 border border-surface-800 cursor-pointer hover:border-surface-700">
            <input
              type="radio"
              name="closeAction"
              value="block_new"
              checked={closeAction === 'block_new'}
              onChange={() => setCloseAction('block_new')}
              className="mt-0.5 text-teal-500 focus:ring-teal-500"
            />
            <div className="text-xs space-y-1">
              <p className="font-bold text-surface-100">
                {t('exams.closeLinkOptionBlock')}
              </p>
              <p className="text-surface-400 text-[11px]">
                Students currently taking the exam can finish normally until their timer expires.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-900 border border-surface-800 cursor-pointer hover:border-surface-700">
            <input
              type="radio"
              name="closeAction"
              value="force_submit"
              checked={closeAction === 'force_submit'}
              onChange={() => setCloseAction('force_submit')}
              className="mt-0.5 text-rose-500 focus:ring-rose-500"
            />
            <div className="text-xs space-y-1">
              <p className="font-bold text-rose-300">
                {t('exams.closeLinkOptionAutoSubmit', { count: inProgressCount })}
              </p>
              <p className="text-surface-400 text-[11px]">
                Immediately submits all active student attempts with their current answers.
              </p>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
}

/* ==========================================================================
   DELETE EXAM WITH TYPED CONFIRMATION DIALOG
   ========================================================================== */
function DeleteExamModal({ isOpen, onClose, exam, onConfirm }) {
  const { t } = useTranslation();
  const [typedTitle, setTypedTitle] = useState('');
  const [forceSubmit, setForceSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!exam) return null;

  const attemptCount = exam.attemptCount || 0;
  const isMatch = typedTitle.trim() === exam.title.trim();

  const handleConfirmDelete = async () => {
    try {
      setSubmitting(true);
      setErrorMsg('');
      await onConfirm(forceSubmit);
      setSubmitting(false);
      onClose();
    } catch (err) {
      setSubmitting(false);
      const data = err.response?.data;
      if (data?.error === 'IN_PROGRESS_ATTEMPTS') {
        setErrorMsg(data.message || t('exams.inProgressDeleteBlocked'));
      } else {
        setErrorMsg(err.response?.data?.error || t('errors.GENERIC'));
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('exams.deleteConfirmTitle')}
      size="md"
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleConfirmDelete}
            disabled={submitting || (attemptCount > 0 && !isMatch)}
          >
            {submitting ? t('common.loading') : t('exams.deleteExam')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-surface-200">
        <p className="text-sm text-surface-300 leading-relaxed">
          {t('exams.deletePreserveNotice', { title: exam.title })}
        </p>

        {attemptCount > 0 && (
          <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-800/60 flex items-start gap-3 text-xs text-teal-300">
            <CheckCircle className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {t('exams.resultsWillBeKept', { count: attemptCount })}
              </p>
              <p className="text-teal-300/80 text-[11px] mt-0.5">
                {t('exams.resultsKeptSub')}
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1 text-rose-200 font-semibold select-none">
              <input
                type="checkbox"
                checked={forceSubmit}
                onChange={(e) => setForceSubmit(e.target.checked)}
                className="rounded border-rose-700 bg-surface-900 text-rose-500 focus:ring-rose-500"
              />
              <span>{t('exams.forceSubmitOptionLabel')}</span>
            </label>
          </div>
        )}

        {attemptCount > 0 && (
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-surface-300">
              {t('exams.typeTitleToConfirm')} <span className="text-surface-100 font-bold select-all">{exam.title}</span>:
            </label>
            <input
              type="text"
              value={typedTitle}
              onChange={(e) => setTypedTitle(e.target.value)}
              placeholder={exam.title}
              className="w-full p-2.5 rounded-xl bg-surface-900 border border-surface-700 text-surface-100 text-sm focus:border-rose-500 focus:outline-none"
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ==========================================================================
   MAIN EXAM LIST PAGE COMPONENT
   ========================================================================== */
export default function ExamList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data states
  const [exams, setExams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Cold start notice timer (> 5s)
  const [showColdStartNotice, setShowColdStartNotice] = useState(false);

  // Modals state
  const [extendTimeTarget, setExtendTimeTarget] = useState(null);
  const [closeLinkTarget, setCloseLinkTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Search & Filter URL Sync States
  const urlQuery = searchParams.get('q') || '';
  const urlCategory = searchParams.get('category') || '';
  const urlStatus = searchParams.get('status') || 'all';
  const urlSort = searchParams.get('sort') || 'newest';

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [categoryFilter, setCategoryFilter] = useState(urlCategory);
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [sortBy, setSortBy] = useState(urlSort);

  const searchInputRef = useRef(null);

  // Sync state to URL without reloading
  const updateUrlParams = useCallback(
    (newQ, newCat, newStat, newSort) => {
      const params = new URLSearchParams();
      if (newQ) params.set('q', newQ);
      if (newCat) params.set('category', newCat);
      if (newStat && newStat !== 'all') params.set('status', newStat);
      if (newSort && newSort !== 'newest') params.set('sort', newSort);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  // Debounced search query update
  useEffect(() => {
    const timer = setTimeout(() => {
      updateUrlParams(searchQuery, categoryFilter, statusFilter, sortBy);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, categoryFilter, statusFilter, sortBy, updateUrlParams]);

  // Global Keyboard Shortcut: '/' to focus search input
  useEffect(() => {
    function handleKeyDown(e) {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch Categories & Exams
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/api/categories');
      setCategories(res.data?.categories || []);
    } catch {
      // ignore
    }
  }, []);

  const fetchExams = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/api/exams');
      setExams(data.exams || []);
    } catch (err) {
      if (!isBackground) {
        setError(err.response?.data?.error || t('errors.GENERIC'));
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchCategories();
    fetchExams();
  }, [fetchCategories, fetchExams]);

  // Cold start 5-second timer
  useEffect(() => {
    let timer;
    if (loading) {
      setShowColdStartNotice(false);
      timer = setTimeout(() => {
        setShowColdStartNotice(true);
      }, 5000);
    } else {
      setShowColdStartNotice(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  // Light background poll every 30s for active exams
  useEffect(() => {
    const hasOpenExams = exams.some((e) => e.status === 'open');
    if (!hasOpenExams) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchExams(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [exams, fetchExams]);

  // Categorize Exam Computed Status (Draft, Open, Scheduled, Closed, Ended)
  const getExamComputedStatus = useCallback((exam) => {
    if (exam.status === 'draft') return 'draft';
    if (exam.status === 'closed') return 'closed';
    return 'open';
  }, []);

  // Filtered & Sorted Exams Computation
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      // 1. Category Filter
      if (categoryFilter) {
        const catId = typeof exam.categoryId === 'object' ? exam.categoryId?._id : exam.categoryId;
        if (catId !== categoryFilter) return false;
      }

      // 2. Status Filter
      const computedStat = getExamComputedStatus(exam);
      if (statusFilter !== 'all' && computedStat !== statusFilter) {
        return false;
      }

      // 3. Multi-word AND Search Filter
      const catName = typeof exam.categoryId === 'object' ? exam.categoryId?.name : '';
      const statusText = t(`exams.${computedStat}Status`);

      return matchSearchQuery(exam, searchQuery, [
        (e) => e.title,
        () => catName,
        () => statusText,
      ]);
    });
  }, [exams, categoryFilter, statusFilter, searchQuery, getExamComputedStatus, t]);

  // Sorted Array
  const sortedExams = useMemo(() => {
    return [...filteredExams].sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === 'title_az') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'submissions') return (b.submittedCount || 0) - (a.submittedCount || 0);
      if (sortBy === 'closing_soon') {
        return 0;
      }
      return 0;
    });
  }, [filteredExams, sortBy]);

  // Status Tab Counts Computation (based on current search + category)
  const statusCounts = useMemo(() => {
    const baseList = exams.filter((exam) => {
      if (categoryFilter) {
        const catId = typeof exam.categoryId === 'object' ? exam.categoryId?._id : exam.categoryId;
        if (catId !== categoryFilter) return false;
      }
      const catName = typeof exam.categoryId === 'object' ? exam.categoryId?.name : '';
      const computedStat = getExamComputedStatus(exam);
      const statusText = t(`exams.${computedStat}Status`);
      return matchSearchQuery(exam, searchQuery, [
        (e) => e.title,
        () => catName,
        () => statusText,
      ]);
    });

    const counts = { all: baseList.length, open: 0, closed: 0 };
    baseList.forEach((e) => {
      const st = getExamComputedStatus(e);
      if (counts[st] !== undefined) counts[st]++;
    });
    return counts;
  }, [exams, categoryFilter, searchQuery, getExamComputedStatus, t]);

  // Actions: Link Toggle with Optimistic Rollback
  const handleToggleStatus = async (exam) => {
    if (exam.status === 'draft' && (exam.questionCount || 0) === 0) {
      setToast({
        message: t('exams.cannotOpenZeroQuestions'),
        type: 'error',
      });
      return;
    }

    if (exam.status === 'open') {
      // Opening close confirmation modal
      setCloseLinkTarget(exam);
    } else {
      // Opening link optimistically
      const previousExams = [...exams];
      setExams((prev) =>
        prev.map((e) => (e._id === exam._id ? { ...e, status: 'open' } : e))
      );
      try {
        await api.patch(`/api/exams/${exam._id}/status`, { status: 'open' });
        setToast({ message: t('exams.openStatus'), type: 'success' });
        fetchExams(true);
      } catch (err) {
        setExams(previousExams); // Rollback
        setToast({
          message: err.response?.data?.error || t('errors.GENERIC'),
          type: 'error',
        });
      }
    }
  };

  const handleConfirmCloseLink = async (closeAction) => {
    if (!closeLinkTarget) return;
    const examId = closeLinkTarget._id;
    const previousExams = [...exams];

    setExams((prev) =>
      prev.map((e) => (e._id === examId ? { ...e, status: 'closed' } : e))
    );

    try {
      await api.patch(`/api/exams/${examId}/status`, { status: 'closed', closeAction });
      setToast({ message: t('exams.closedStatus'), type: 'success' });
      fetchExams(true);
    } catch (err) {
      setExams(previousExams); // Rollback
      setToast({
        message: err.response?.data?.error || t('errors.GENERIC'),
        type: 'error',
      });
    }
  };

  // Action: Duplicate Exam Optimistically
  const handleDuplicate = async (examId) => {
    try {
      const { data } = await api.post(`/api/exams/${examId}/duplicate`);
      setToast({ message: t('exams.duplicateExam'), type: 'success' });
      navigate(`/admin/exams/${data.exam._id}`);
    } catch (err) {
      setToast({
        message: err.response?.data?.error || t('errors.GENERIC'),
        type: 'error',
      });
    }
  };

  // Action: Regenerate Link Token
  const handleRegenerateLink = async (examId) => {
    if (window.confirm(t('exams.regenerateLinkConfirm'))) {
      try {
        const { data } = await api.patch(`/api/exams/${examId}/regenerate-token`);
        setExams((prev) =>
          prev.map((e) => (e._id === examId ? { ...e, accessToken: data.accessToken } : e))
        );
        setToast({ message: t('exams.copyLinkSuccess'), type: 'success' });
      } catch (err) {
        setToast({
          message: err.response?.data?.error || t('errors.GENERIC'),
          type: 'error',
        });
      }
    }
  };

  // Action: Delete Exam (removes definition, preserves student results)
  const handleDeleteConfirm = async (forceSubmit = false) => {
    if (!deleteTarget) return;
    try {
      const res = await api.delete(`/api/exams/${deleteTarget._id}`, {
        data: { forceSubmit },
      });
      setToast({
        message: res.data?.message || t('exams.deleteSuccessPreserved'),
        type: 'success',
      });
      setDeleteTarget(null);
      fetchExams(true);
    } catch (err) {
      throw err; // Propagate to DeleteExamModal for error handling
    }
  };

  // Action: Download Word Paper
  const handleDownloadWord = async (exam) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${api.defaults.baseURL || ''}/api/exams/${exam._id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exam.title.replace(/[^a-z0-9]/gi, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setToast({ message: t('errors.GENERIC'), type: 'error' });
    }
  };

  // Action: Copy Link
  const handleCopyLink = (token) => {
    const url = `${window.location.origin}/exam/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setToast({ message: t('exams.copyLinkSuccess'), type: 'info' });
    });
  };

  // Active filters count
  const activeFiltersCount =
    (categoryFilter ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (sortBy !== 'newest' ? 1 : 0) +
    (searchQuery ? 1 : 0);

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setStatusFilter('all');
    setSortBy('newest');
    updateUrlParams('', '', 'all', 'newest');
  };

  if (loading && exams.length === 0) {
    return (
      <div className="space-y-4">
        {showColdStartNotice && (
          <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-300 text-xs text-center animate-fade-in">
            {t('common.wakingUpServer')}
          </div>
        )}
        <LoadingScreen message={t('common.loading')} />
      </div>
    );
  }

  if (error && exams.length === 0) {
    return <ErrorState message={error} onRetry={() => fetchExams()} />;
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-100 tracking-tight">
            {t('exams.title')}
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400">
            {activeFiltersCount > 0
              ? t('exams.showingCount', { shown: filteredExams.length, total: exams.length })
              : t('exams.totalExams', { count: exams.length })}
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => navigate('/admin/exams/new')}
          className="w-full sm:w-auto min-h-[44px] shadow-lg shadow-primary-600/20"
        >
          <Plus className="w-5 h-5 shrink-0" />
          <span>{t('exams.createExam')}</span>
        </Button>
      </div>

      {/* 2. COMPACT TOOLBAR CARD */}
      <div className="glass-card p-3 sm:p-4 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm space-y-3.5">
        {/* Row 1: Search Bar & Sort Dropdown */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Search Bar Input */}
          <div className="relative flex-1 w-full min-w-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              aria-label={t('exams.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && searchQuery) {
                  setSearchQuery('');
                }
              }}
              placeholder={t('exams.searchPlaceholder')}
              className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100 text-base sm:text-sm placeholder-surface-400 focus:outline-none focus:border-primary-500 transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-surface-400 hover:text-surface-200 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <kbd className="hidden lg:inline-flex absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-bold text-surface-500 bg-surface-800 border border-surface-700 rounded shadow-xs pointer-events-none">
                /
              </kbd>
            )}
          </div>

          {/* Category Filter Select (Desktop & Tablet) */}
          <div className="hidden sm:block w-48 shrink-0">
            <select
              value={categoryFilter}
              aria-label={t('exams.filterByCategory')}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-200 text-xs font-semibold focus:outline-none focus:border-primary-500 cursor-pointer"
            >
              <option value="">{t('exams.allCategories')}</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Dropdown (Desktop & Tablet) */}
          <div className="hidden sm:block w-44 shrink-0">
            <select
              value={sortBy}
              aria-label="Sort exams"
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-200 text-xs font-semibold focus:outline-none focus:border-primary-500 cursor-pointer"
            >
              <option value="newest">{t('exams.sortNewest')}</option>
              <option value="oldest">{t('exams.sortOldest')}</option>
              <option value="title_az">{t('exams.sortTitleAZ')}</option>
              <option value="submissions">{t('exams.sortSubmissions')}</option>
              <option value="closing_soon">{t('exams.sortClosingSoon')}</option>
            </select>
          </div>

          {/* Mobile Bottom Sheet Trigger Button (<640px) */}
          <div className="sm:hidden w-full flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-surface-800/80 border border-surface-700 text-xs font-bold text-surface-200 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-primary-400" />
              <span>{t('students.filters')}</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary-600 text-white text-[10px]">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="h-11 px-3 text-xs font-semibold text-rose-400 hover:underline shrink-0"
              >
                {t('exams.clearFilters')}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Status Segmented Chips / Tabs (Horizontally scrollable on mobile) */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pt-1 pb-0.5">
          <div className="flex items-center gap-1.5 shrink-0">
            {[
              { id: 'all', label: t('exams.allStatus'), count: statusCounts.all },
              { id: 'open', label: t('exams.openStatus'), count: statusCounts.open },
              { id: 'closed', label: t('exams.closedStatus'), count: statusCounts.closed },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-xs'
                      : 'bg-surface-800/40 hover:bg-surface-800/80 text-surface-300 hover:text-surface-100 border border-surface-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-surface-800 text-surface-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Desktop Clear Filters button */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-primary-400 hover:underline shrink-0 ml-2"
            >
              <span>{t('exams.clearFilters')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. EXAM LIST / CARDS SECTION */}
      {sortedExams.length === 0 ? (
        <div className="glass-card p-12 text-center rounded-2xl border border-surface-200 dark:border-surface-800 space-y-4">
          <div className="w-16 h-16 rounded-full bg-surface-800 flex items-center justify-center mx-auto text-surface-400">
            <FileText className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-surface-100">
              {searchQuery || categoryFilter || statusFilter !== 'all'
                ? `No exams match "${searchQuery || 'selected filters'}"`
                : t('exams.noExamsTitle')}
            </h3>
            <p className="text-xs text-surface-400 max-w-sm mx-auto">
              {searchQuery || categoryFilter || statusFilter !== 'all'
                ? 'Try tweaking your search term or clearing active filters.'
                : t('exams.noExamsMessage')}
            </p>
          </div>
          <div>
            {activeFiltersCount > 0 ? (
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                {t('exams.clearFilters')}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => navigate('/admin/exams/new')}>
                <Plus className="w-4 h-4" />
                <span>{t('exams.createExam')}</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedExams.map((exam) => {
            const computedStatus = getExamComputedStatus(exam);
            const isOpen = computedStatus === 'open';
            const isClosed = computedStatus === 'closed';

            const categoryName =
              typeof exam.categoryId === 'object' ? exam.categoryId?.name : '';

            const submitted = exam.submittedCount || 0;
            const eligible = exam.eligibleCount || 0;
            const inProgress = exam.inProgressCount || 0;
            const progressPercent =
              eligible > 0 ? Math.min(100, Math.round((submitted / eligible) * 100)) : 0;

            return (
              <div
                key={exam._id}
                tabIndex={0}
                onClick={() => navigate(`/admin/exams/${exam._id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/admin/exams/${exam._id}`);
                }}
                className="glass-card p-4 sm:p-6 rounded-2xl border border-surface-200 dark:border-surface-800 hover:border-surface-400 dark:hover:border-surface-600 transition-all duration-200 space-y-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary-500 outline-none group"
              >
                {/* Breakpoint layout wrapper */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Block: Title, Badges, Meta, Progress */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Header line: Title & Badges */}
                    <div className="flex items-start sm:items-center gap-2.5 flex-wrap">
                      <h2
                        className="font-bold text-base sm:text-lg text-surface-900 dark:text-surface-100 group-hover:text-primary-500 transition-colors line-clamp-2"
                        dir="auto"
                      >
                        {exam.title}
                      </h2>

                      {/* Status Badge (ONE status badge with icon + text) */}

                      {isOpen && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 flex items-center gap-1.5 shrink-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>{t('exams.openStatus')}</span>
                        </span>
                      )}
                      {/* Exam Language Badge */}
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-950/60 text-teal-300 border border-teal-800/80 shrink-0 uppercase flex items-center gap-1">
                        <span>🌐</span>
                        <span>{exam.language === 'ar' ? 'العربية (AR)' : exam.language === 'am' ? 'አማርኛ (AM)' : 'English (EN)'}</span>
                      </span>

                      {/* Category Badge */}
                      {categoryName && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-surface-800/60 text-surface-300 border border-surface-700/60 shrink-0">
                          {categoryName}
                        </span>
                      )}
                    </div>

                    {/* Meta Row: Muted icons, consistent design */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-surface-400 font-medium">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <span>{formatDurationMinutes(exam.durationMinutes)}</span>
                      </span>

                      <span className="flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <span>{t('common.questions', { count: exam.questionCount || 0 })}</span>
                      </span>

                      <span className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-surface-400 shrink-0" />
                        <span>{exam.totalMarks || 0} pts</span>
                      </span>

                      <span className="flex items-center gap-1.5">
                        <span>Created: {formatDate(exam.createdAt)}</span>
                      </span>

                    </div>

                    {/* Submissions Progress Bar */}
                    <div className="space-y-1 pt-1 max-w-xl">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-surface-300">
                          {t('exams.submittedProgress', { submitted, eligible })}
                        </span>

                        {inProgress > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/60 text-[11px] font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                            <span>{t('exams.inProgressBadge', { count: inProgress })}</span>
                          </span>
                        )}
                      </div>

                      <div className="w-full h-1.5 rounded-full bg-surface-800 overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Action Block (100% responsive on mobile, tablet & desktop) */}
                  <div className="pt-3 lg:pt-0 border-t lg:border-t-0 border-surface-800 w-full lg:w-auto" onClick={(e) => e.stopPropagation()}>
                    <ActionRow>
                      <Button
                        variant="primary"
                        size="md"
                        fullWidth
                        iconStart={Edit3}
                        onClick={() => navigate(`/admin/exams/${exam._id}`)}
                      >
                        {t('common.edit') || 'Edit'}
                      </Button>

                      {isOpen ? (
                        <Button
                          variant="secondary"
                          size="md"
                          fullWidth
                          iconStart={LinkIcon}
                          onClick={() => handleCopyLink(exam.accessToken)}
                        >
                          {t('common.copy') || 'Copy link'}
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="md"
                          fullWidth
                          iconStart={isOpen ? CheckCircle2 : Lock}
                          onClick={() => handleToggleStatus(exam)}
                        >
                          {isOpen ? (t('exams.openStatus') || 'Open') : (t('exams.closedStatus') || 'Closed')}
                        </Button>
                      )}

                      <MenuButton
                        items={[
                          isOpen && inProgress > 0 && {
                            label: t('exams.extendTime') || 'Extend time',
                            icon: Clock,
                            onClick: () => setExtendTimeTarget(exam),
                          },
                          isOpen && {
                            label: t('exams.closedStatus') || 'Close exam',
                            icon: Lock,
                            onClick: () => handleToggleStatus(exam),
                          },
                          !isOpen && {
                            label: t('exams.openStatus') || 'Open exam',
                            icon: CheckCircle2,
                            onClick: () => handleToggleStatus(exam),
                          },
                          {
                            label: t('exams.duplicate') || 'Duplicate',
                            icon: Copy,
                            onClick: () => handleDuplicate(exam._id),
                          },
                          {
                            label: t('exams.downloadWord') || 'Word document',
                            icon: Download,
                            onClick: () => handleDownloadWord(exam),
                          },
                          {
                            label: t('exams.regenerateLink') || 'Regenerate link',
                            icon: RefreshCw,
                            onClick: () => handleRegenerateLink(exam._id),
                          },
                          {
                            label: t('common.delete') || 'Delete',
                            icon: Trash2,
                            danger: true,
                            onClick: () => setDeleteTarget(exam),
                          },
                        ].filter(Boolean)}
                      />
                    </ActionRow>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. MODALS & DIALOGS */}
      {/* Extend Time Modal */}
      <ExtendTimeDialog
        isOpen={!!extendTimeTarget}
        onClose={() => setExtendTimeTarget(null)}
        exam={extendTimeTarget}
        onSuccess={(data) => {
          setToast({
            message: t('exams.extendSuccess', {
              minutes: data.durationMinutes ? 5 : 5,
              count: data.updatedAttemptsCount || 0,
            }),
            type: 'success',
          });
          fetchExams(true);
        }}
      />

      {/* Close Link Modal */}
      <CloseLinkModal
        isOpen={!!closeLinkTarget}
        onClose={() => setCloseLinkTarget(null)}
        exam={closeLinkTarget}
        onConfirm={handleConfirmCloseLink}
      />

      {/* Delete Exam Modal */}
      <DeleteExamModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        exam={deleteTarget}
        onConfirm={handleDeleteConfirm}
      />

      {/* Mobile Filters Bottom Sheet */}
      {mobileFiltersOpen && (
        <Modal
          isOpen={mobileFiltersOpen}
          onClose={() => setMobileFiltersOpen(false)}
          title={t('exams.filtersBottomSheetTitle')}
          size="sm"
          footer={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  handleClearFilters();
                  setMobileFiltersOpen(false);
                }}
                className="flex-1"
              >
                {t('exams.clearFilters')}
              </Button>
              <Button
                variant="primary"
                onClick={() => setMobileFiltersOpen(false)}
                className="flex-1"
              >
                {t('exams.applyFilters')}
              </Button>
            </div>
          }
        >
          <div className="space-y-4 text-surface-200 py-2">
            {/* Category Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-300">
                {t('exams.filterByCategory')}
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-900 border border-surface-700 text-surface-100 text-xs font-semibold focus:outline-none"
              >
                <option value="">{t('exams.allCategories')}</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-300">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-surface-900 border border-surface-700 text-surface-100 text-xs font-semibold focus:outline-none"
              >
                <option value="newest">{t('exams.sortNewest')}</option>
                <option value="oldest">{t('exams.sortOldest')}</option>
                <option value="title_az">{t('exams.sortTitleAZ')}</option>
                <option value="submissions">{t('exams.sortSubmissions')}</option>
                <option value="closing_soon">{t('exams.sortClosingSoon')}</option>
              </select>
            </div>

            {/* Status Choice */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-300">Status</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'all', label: t('exams.allStatus') },
                  { id: 'open', label: t('exams.openStatus') },
                  { id: 'draft', label: t('exams.draftStatus') },
                  { id: 'closed', label: t('exams.closedStatus') },
                  { id: 'scheduled', label: t('exams.scheduledStatus') },
                  { id: 'ended', label: t('exams.endedStatus') },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStatusFilter(st.id)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      statusFilter === st.id
                        ? 'bg-primary-600 text-white border-primary-500'
                        : 'bg-surface-900 border-surface-800 text-surface-400'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
