import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import Modal, { ConfirmDialog } from '../Modal';
import Button from '../Button';
import Input from '../Input';
import {
  UserRound,
  User,
  Copy,
  Check,
  Mail,
  Calendar,
  Clock,
  Hourglass,
  Award,
  TrendingUp,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trash2,
  Edit3,
  Key,
  MoreVertical,
  Search,
  RefreshCw,
  FileCheck,
  Link as LinkIcon,
  Link2Off,
  FilterX,
  Eye,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';

// SWR-style client cache for student profiles
const profileCache = new Map();

// Color pairs for initials avatar derived deterministically from ID
const AVATAR_COLORS = [
  { bg: 'bg-teal-500/15', border: 'border-teal-500/30', text: 'text-teal-600 dark:text-teal-400' },
  { bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', text: 'text-indigo-600 dark:text-indigo-400' },
  { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400' },
  { bg: 'bg-violet-500/15', border: 'border-violet-500/30', text: 'text-violet-600 dark:text-violet-400' },
  { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-600 dark:text-rose-400' },
];

function getAvatarStyle(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'ST';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelativeTime(dateString, locale = 'en') {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffInSeconds = Math.round((date.getTime() - now.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const absSec = Math.abs(diffInSeconds);
  if (absSec < 60) return rtf.format(Math.round(diffInSeconds), 'second');
  if (absSec < 3600) return rtf.format(Math.round(diffInSeconds / 60), 'minute');
  if (absSec < 86400) return rtf.format(Math.round(diffInSeconds / 3600), 'hour');
  if (absSec < 2592000) return rtf.format(Math.round(diffInSeconds / 86400), 'day');
  return rtf.format(Math.round(diffInSeconds / 2592000), 'month');
}

export default function StudentProfileModal({
  studentId,
  onClose,
  onStudentUpdated,
  onOpenGrading,
}) {
  const { t, i18n } = useTranslation();
  const activeLocale = i18n.language || 'en';

  // Data states
  const [profileData, setProfileData] = useState(profileCache.get(studentId) || null);
  const [loading, setLoading] = useState(!profileCache.has(studentId));
  const [error, setError] = useState(null);

  // Copy state
  const [copiedKey, setCopiedKey] = useState(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    gender: 'male',
    categoryIds: [],
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Action dialogs
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resetPasswordResult, setResetPasswordResult] = useState(null); // { newPassword }

  // Row action confirm dialogs
  const [retakeTarget, setRetakeTarget] = useState(null);
  const [resetAttemptTarget, setResetAttemptTarget] = useState(null);

  // Exam list filters & search & pagination
  const [examSearch, setExamSearch] = useState('');
  const [examFilter, setExamFilter] = useState('all'); // 'all', 'not_taken', 'in_progress', 'needs_correction', 'completed'
  const [visibleCount, setVisibleCount] = useState(10);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);

  // Deep Link URL Sync (?student=<id>)
  useEffect(() => {
    if (!studentId) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get('student') !== studentId) {
      url.searchParams.set('student', studentId);
      window.history.pushState({ studentId }, '', url.toString());
    }

    const handlePopState = (e) => {
      const currentUrl = new URL(window.location.href);
      if (!currentUrl.searchParams.get('student')) {
        onClose();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [studentId, onClose]);

  const closeAndCleanUrl = useCallback(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('student')) {
      url.searchParams.delete('student');
      window.history.replaceState({}, '', url.toString());
    }
    onClose();
  }, [onClose]);

  // Fetch Student Profile
  const fetchProfile = useCallback(
    async (id, forceRefresh = false) => {
      if (!id) return;
      if (!forceRefresh && profileCache.has(id)) {
        setProfileData(profileCache.get(id));
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await api.get(`/api/users/${id}/profile`);
        profileCache.set(id, res.data);
        setProfileData(res.data);
      } catch (err) {
        setError(err.response?.data?.error || t('errors.GENERIC') || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (studentId) {
      setIsEditing(false);
      setHasUnsavedChanges(false);
      fetchProfile(studentId);
    }
  }, [studentId, fetchProfile]);

  // Click outside listener for more menu dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Copy helper
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Start Edit Mode
  const startEdit = () => {
    if (!profileData?.student) return;
    const s = profileData.student;
    setEditForm({
      fullName: s.fullName || '',
      email: s.email || '',
      gender: s.gender || 'male',
      categoryIds: (s.categoryIds || []).map((c) => c._id || c),
    });
    setHasUnsavedChanges(false);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm(t('students.unsavedWarning') || 'You have unsaved changes. Cancel anyway?')) {
        return;
      }
    }
    setIsEditing(false);
    setHasUnsavedChanges(false);
  };

  // Save Edit Handler
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      await api.put(`/api/users/${studentId}`, editForm);
      profileCache.delete(studentId);
      await fetchProfile(studentId, true);
      setIsEditing(false);
      setHasUnsavedChanges(false);
      if (onStudentUpdated) onStudentUpdated();
    } catch (err) {
      alert(err.response?.data?.error || t('errors.GENERIC') || 'Failed to update profile');
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle Deactivate / Activate
  const handleToggleActive = async () => {
    if (!profileData?.student) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/users/${studentId}/deactivate`);
      profileCache.delete(studentId);
      await fetchProfile(studentId, true);
      setDeactivateConfirm(false);
      if (onStudentUpdated) onStudentUpdated();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to change student status');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Student
  const handleDeleteStudent = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/api/users/${studentId}`);
      profileCache.delete(studentId);
      setDeleteConfirm(false);
      if (onStudentUpdated) onStudentUpdated();
      closeAndCleanUrl();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete student');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Password
  const handleResetPassword = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/api/users/${studentId}/reset-password`);
      setResetPasswordResult(res.data.generatedPassword || 'New password generated');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  // Allow Retake Handler
  const handleAllowRetake = async () => {
    if (!retakeTarget) return;
    setActionLoading(true);
    try {
      await api.post(`/api/results/attempt/${retakeTarget.attemptId}/allow-retake`);
      profileCache.delete(studentId);
      await fetchProfile(studentId, true);
      setRetakeTarget(null);
      if (onStudentUpdated) onStudentUpdated();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to allow retake');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Attempt Handler
  const handleResetAttempt = async () => {
    if (!resetAttemptTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/api/results/attempt/${resetAttemptTarget.attemptId}`);
      profileCache.delete(studentId);
      await fetchProfile(studentId, true);
      setResetAttemptTarget(null);
      if (onStudentUpdated) onStudentUpdated();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset attempt');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered & Searched Exams
  const filteredExams = useMemo(() => {
    if (!profileData?.exams) return [];
    let list = [...profileData.exams];

    // Search filter
    if (examSearch.trim()) {
      const q = examSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.examTitle.toLowerCase().includes(q) ||
          e.categoryName.toLowerCase().includes(q)
      );
    }

    // Status filter chip
    if (examFilter === 'not_taken') {
      list = list.filter((e) => e.statusKey === 'not_taken');
    } else if (examFilter === 'in_progress') {
      list = list.filter((e) => e.statusKey === 'in_progress');
    } else if (examFilter === 'needs_correction') {
      list = list.filter((e) => e.statusKey === 'needs_correction');
    } else if (examFilter === 'completed') {
      list = list.filter((e) => e.statusKey === 'graded');
    }

    return list;
  }, [profileData, examSearch, examFilter]);

  const visibleExams = useMemo(
    () => filteredExams.slice(0, visibleCount),
    [filteredExams, visibleCount]
  );

  const student = profileData?.student;
  const stats = profileData?.stats;
  const avatarStyle = getAvatarStyle(student?.studentId || student?._id || '');
  const initials = getInitials(student?.fullName || '');

  // Header element
  const headerContent = (
    <div className="flex items-center gap-2.5 min-w-0">
      <UserRound className="w-5 h-5 text-primary-500 shrink-0" />
      <span className="truncate">{t('students.studentProfile') || 'Student profile'}</span>
    </div>
  );

  // Sticky footer element
  const modalFooter = (
    <div className="flex items-center justify-between gap-3 w-full">
      {isEditing ? (
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={cancelEdit}
            disabled={savingEdit}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSaveEdit}
            disabled={savingEdit}
            className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {savingEdit ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            {t('students.saveProfile') || 'Save Profile'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={closeAndCleanUrl}
          className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold rounded-xl bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 transition-colors cursor-pointer text-center"
        >
          {t('common.close') || 'Close'}
        </button>
      )}
    </div>
  );

  return (
    <>
      <Modal
        isOpen={Boolean(studentId)}
        onClose={hasUnsavedChanges ? cancelEdit : closeAndCleanUrl}
        title={headerContent}
        size="lg"
        footer={modalFooter}
        hasUnsavedChanges={hasUnsavedChanges}
      >
        {loading ? (
          /* Skeleton Loader matching final layout */
          <div className="space-y-6 animate-pulse" aria-live="polite" aria-busy="true">
            {/* Header profile skeleton */}
            <div className="p-4 sm:p-5 rounded-2xl bg-surface-100 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-surface-300 dark:bg-surface-700 shrink-0" />
              <div className="space-y-2 flex-1 w-full">
                <div className="h-5 bg-surface-300 dark:bg-surface-700 rounded-md w-1/3" />
                <div className="h-4 bg-surface-200 dark:bg-surface-800 rounded-md w-2/3" />
              </div>
            </div>

            {/* Definition grid skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-surface-100 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-700/40 p-3" />
              ))}
            </div>

            {/* Stat cards skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-surface-100 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-700/40 p-3" />
              ))}
            </div>

            {/* Exam list skeleton */}
            <div className="space-y-3">
              <div className="h-5 bg-surface-300 dark:bg-surface-700 rounded-md w-1/4" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-surface-100 dark:bg-surface-800/40 border border-surface-200/60 dark:border-surface-700/40" />
                ))}
              </div>
            </div>
          </div>
        ) : error ? (
          /* Error State with Retry */
          <div className="py-12 px-4 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-500 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">
                {t('errors.failedToLoad') || 'Failed to load student profile'}
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 max-w-sm mx-auto">
                {error}
              </p>
            </div>
            <button
              onClick={() => fetchProfile(studentId, true)}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('common.retry') || 'Retry'}</span>
            </button>
          </div>
        ) : isEditing ? (
          /* Inline Edit Form (View <-> Edit Mode) */
          <form onSubmit={handleSaveEdit} className="space-y-5">
            <div className="p-4 rounded-2xl bg-surface-100/80 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700">
              <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 mb-4">
                {t('students.editProfile') || 'Edit Student Profile'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    {t('students.fullName') || 'Full Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    dir="auto"
                    value={editForm.fullName}
                    onChange={(e) => {
                      setEditForm((prev) => ({ ...prev, fullName: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 focus:ring-2 focus:ring-primary-500 text-surface-900 dark:text-surface-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    {t('students.email') || 'Email Address'}
                  </label>
                  <input
                    type="email"
                    dir="auto"
                    value={editForm.email}
                    onChange={(e) => {
                      setEditForm((prev) => ({ ...prev, email: e.target.value }));
                      setHasUnsavedChanges(true);
                    }}
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 text-sm rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 focus:ring-2 focus:ring-primary-500 text-surface-900 dark:text-surface-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                    {t('students.gender') || 'Gender'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                        editForm.gender === 'male'
                          ? 'bg-primary-500/15 border-primary-500 text-primary-600 dark:text-primary-300 ring-2 ring-primary-500/20'
                          : 'bg-surface-50 dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value="male"
                        checked={editForm.gender === 'male'}
                        onChange={(e) => {
                          setEditForm((prev) => ({ ...prev, gender: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        className="sr-only"
                      />
                      <span>{t('students.male') || 'Male'}</span>
                    </label>

                    <label
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition-all ${
                        editForm.gender === 'female'
                          ? 'bg-primary-500/15 border-primary-500 text-primary-600 dark:text-primary-300 ring-2 ring-primary-500/20'
                          : 'bg-surface-50 dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value="female"
                        checked={editForm.gender === 'female'}
                        onChange={(e) => {
                          setEditForm((prev) => ({ ...prev, gender: e.target.value }));
                          setHasUnsavedChanges(true);
                        }}
                        className="sr-only"
                      />
                      <span>{t('students.female') || 'Female'}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </form>
        ) : (
          /* View Profile Mode */
          <div className="space-y-6">
            {/* 1. Profile Summary Top Header & Action Row */}
            <div className="p-4 sm:p-5 rounded-2xl bg-surface-100/90 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Initials Avatar */}
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${avatarStyle.bg} ${avatarStyle.border} ${avatarStyle.text} border flex items-center justify-center font-bold text-base sm:text-lg shrink-0`}
                >
                  {initials}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      dir="auto"
                      className="text-base sm:text-xl font-bold text-surface-900 dark:text-surface-100 break-words"
                    >
                      {student?.fullName}
                    </h2>
                    {/* Active/Inactive dot badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${
                        student?.isActive
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          student?.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      <span>{student?.isActive ? t('common.active') || 'Active' : t('common.inactive') || 'Inactive'}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {/* Monospace Student ID chip with copy button */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-200/80 dark:bg-surface-700/80 font-mono text-xs font-medium text-surface-800 dark:text-surface-200 border border-surface-300/60 dark:border-surface-600/60">
                      <span>{student?.studentId || 'No ID'}</span>
                      {student?.studentId && (
                        <button
                          onClick={() => handleCopy(student.studentId, 'id')}
                          className="p-1 hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
                          title="Copy Student ID"
                        >
                          {copiedKey === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Desktop & Mobile Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                {/* Desktop view button row */}
                <div className="hidden sm:flex items-center gap-2">
                  <button
                    onClick={startEdit}
                    className="px-3.5 py-2 rounded-xl bg-surface-200/80 dark:bg-surface-700/80 hover:bg-surface-300 dark:hover:bg-surface-600 text-xs font-semibold text-surface-800 dark:text-surface-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{t('students.editProfile') || 'Edit profile'}</span>
                  </button>

                  <button
                    onClick={handleResetPassword}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl bg-surface-200/80 dark:bg-surface-700/80 hover:bg-surface-300 dark:hover:bg-surface-600 text-xs font-semibold text-surface-800 dark:text-surface-200 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>{t('students.resetPassword') || 'Reset password'}</span>
                  </button>

                  {/* 3-dots Menu Dropdown */}
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      onClick={() => setMoreMenuOpen((prev) => !prev)}
                      className="p-2 rounded-xl bg-surface-200/80 dark:bg-surface-700/80 hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 transition-colors cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
                      aria-label="More options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {moreMenuOpen && (
                      <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-xl py-1 z-50 animate-pop-in">
                        <button
                          onClick={() => {
                            setMoreMenuOpen(false);
                            setDeactivateConfirm(true);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                            student?.isActive
                              ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                              : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>{student?.isActive ? t('students.deactivateStudent') || 'Deactivate' : t('students.activateStudent') || 'Activate'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setMoreMenuOpen(false);
                            setDeleteConfirm(true);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors cursor-pointer border-t border-surface-200 dark:border-surface-700/60"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{t('students.deleteStudent') || 'Delete student'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mobile view action buttons layout */}
                <div className="flex sm:hidden flex-col gap-2">
                  <button
                    onClick={startEdit}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>{t('students.editProfile') || 'Edit profile'}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetPassword}
                      disabled={actionLoading}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-800 dark:text-surface-200 text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Key className="w-3.5 h-3.5" />
                      <span>{t('students.resetPassword') || 'Reset password'}</span>
                    </button>
                    <button
                      onClick={() => setDeactivateConfirm(true)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                        student?.isActive
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      <span>{student?.isActive ? 'Deactivate' : 'Activate'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Definition Grid (1 col < 640px, 2 cols from 640px, 3 cols from 1024px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 rounded-2xl bg-surface-100/70 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700/60">
              {/* Student ID */}
              <div className="min-w-0">
                <div className="text-xs text-surface-500 dark:text-surface-400 font-medium mb-1">
                  {t('students.studentId') || 'Student ID'}
                </div>
                <div className="font-mono text-xs font-semibold text-surface-900 dark:text-surface-100 break-words">
                  {student?.studentId || '—'}
                </div>
              </div>

              {/* Email */}
              <div className="min-w-0">
                <div className="text-xs text-surface-500 dark:text-surface-400 font-medium mb-1">
                  {t('students.email') || 'Email'}
                </div>
                {student?.email ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <a
                      href={`mailto:${student.email}`}
                      dir="auto"
                      className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline break-words min-w-0 truncate"
                    >
                      {student.email}
                    </a>
                    <button
                      onClick={() => handleCopy(student.email, 'email')}
                      className="p-1 hover:text-primary-600 dark:hover:text-primary-400 text-surface-400 transition-colors cursor-pointer shrink-0 min-w-[24px] min-h-[24px] flex items-center justify-center"
                      title="Copy Email"
                    >
                      {copiedKey === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-surface-400 italic">{t('students.none') || 'None'}</div>
                )}
              </div>

              {/* Gender */}
              <div className="min-w-0">
                <div className="text-xs text-surface-500 dark:text-surface-400 font-medium mb-1">
                  {t('students.gender') || 'Gender'}
                </div>
                <div className="text-xs font-semibold text-surface-900 dark:text-surface-100 capitalize flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-surface-400" />
                  <span>{student?.gender ? t(`students.${student.gender}`) || student.gender : 'Unspecified'}</span>
                </div>
              </div>

              {/* Joined Date */}
              <div className="min-w-0">
                <div className="text-xs text-surface-500 dark:text-surface-400 font-medium mb-1">
                  {t('students.joined') || 'Joined Date'}
                </div>
                <div className="text-xs font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-surface-400" />
                  <span>
                    {student?.createdAt
                      ? new Intl.DateTimeFormat(activeLocale, { dateStyle: 'medium' }).format(new Date(student.createdAt))
                      : '—'}
                  </span>
                </div>
              </div>

              {/* Last Login */}
              <div className="min-w-0">
                <div className="text-xs text-surface-500 dark:text-surface-400 font-medium mb-1">
                  {t('students.lastLogin') || 'Last Login'}
                </div>
                <div className="text-xs font-semibold text-surface-900 dark:text-surface-100 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-surface-400" />
                  <span>
                    {student?.updatedAt ? formatRelativeTime(student.updatedAt, activeLocale) || t('students.never') || 'Never' : t('students.never') || 'Never'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Stat Cards (4 columns >= 768px, 2x2 grid on phones) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Assigned Exams */}
              <div className="p-3.5 rounded-xl bg-surface-100/70 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700/60 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-surface-500 dark:text-surface-400 leading-tight">
                    {t('students.assignedExams') || 'Assigned Exams'}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-surface-200/80 dark:bg-surface-700/80 text-surface-600 dark:text-surface-300 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold tabular-nums text-surface-900 dark:text-surface-100">
                  {stats?.totalAssigned ?? 0}
                </div>
              </div>

              {/* Completed */}
              <div
                className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                  (stats?.totalCompleted || 0) > 0
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-surface-100/70 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700/60 text-surface-500'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium leading-tight">
                    {t('students.completed') || 'Completed'}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      (stats?.totalCompleted || 0) > 0
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-surface-200/80 dark:bg-surface-700/80 text-surface-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold tabular-nums">
                  {stats?.totalCompleted ?? 0}
                  <span className="text-xs font-normal opacity-75 ml-1">
                    {t('students.ofAssigned', { count: stats?.totalAssigned ?? 0 }) || `of ${stats?.totalAssigned ?? 0}`}
                  </span>
                </div>
              </div>

              {/* Awaiting Correction (clickable filter trigger) */}
              <div
                onClick={() => {
                  if ((stats?.totalAwaitingCorrection || 0) > 0) {
                    setExamFilter('needs_correction');
                  }
                }}
                className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                  (stats?.totalAwaitingCorrection || 0) > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-500/20 ring-2 ring-amber-500/20'
                    : 'bg-surface-100/70 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700/60 text-surface-500'
                }`}
                title={stats?.totalAwaitingCorrection > 0 ? 'Click to filter list to awaiting correction' : ''}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium leading-tight">
                    {t('students.awaitingCorrection') || 'Awaiting Correction'}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      (stats?.totalAwaitingCorrection || 0) > 0
                        ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                        : 'bg-surface-200/80 dark:bg-surface-700/80 text-surface-400'
                    }`}
                  >
                    <Hourglass className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-bold tabular-nums">
                  {stats?.totalAwaitingCorrection ?? 0}
                </div>
              </div>

              {/* Average Score */}
              {(() => {
                const avg = stats?.averagePercentage;
                let colorClasses = 'bg-surface-100/70 dark:bg-surface-800/50 border-surface-200 dark:border-surface-700/60 text-surface-500';
                let IconComponent = TrendingUp;

                if (avg !== null && avg !== undefined) {
                  if (avg >= 80) {
                    colorClasses = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
                    IconComponent = Award;
                  } else if (avg >= 50) {
                    colorClasses = 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400';
                    IconComponent = TrendingUp;
                  } else {
                    colorClasses = 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400';
                    IconComponent = AlertCircle;
                  }
                }

                return (
                  <div className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 ${colorClasses}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium leading-tight">
                        {t('students.averageScore') || 'Average Score'}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-current/10 flex items-center justify-center shrink-0">
                        <IconComponent className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="text-xl sm:text-2xl font-bold tabular-nums" title={avg === null ? t('students.noGradedExams') || 'No graded exams yet' : ''}>
                      {avg !== null && avg !== undefined ? `${avg}%` : '—'}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* 4. Exam History List */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">
                    {t('students.examHistory') || 'Exam History'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300">
                    {filteredExams.length}
                  </span>
                </div>

                {/* Small search box if > 5 exams */}
                {profileData?.exams && profileData.exams.length > 5 && (
                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      type="text"
                      dir="auto"
                      placeholder={t('students.searchExams') || 'Search exams...'}
                      value={examSearch}
                      onChange={(e) => setExamSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 focus:ring-1 focus:ring-primary-500 text-surface-900 dark:text-surface-100"
                    />
                  </div>
                )}
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: t('common.all') || 'All' },
                  { id: 'not_taken', label: t('students.filterNotTaken') || 'Not Taken' },
                  { id: 'in_progress', label: t('students.filterInProgress') || 'In Progress' },
                  { id: 'needs_correction', label: t('students.filterAwaitingCorrection') || 'Awaiting Correction' },
                  { id: 'completed', label: t('students.filterCompleted') || 'Completed' },
                ].map((chip) => {
                  const isActive = examFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      onClick={() => setExamFilter(chip.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-primary-600 text-white shadow-sm'
                          : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* Exam Records Content */}
              {filteredExams.length === 0 ? (
                /* Empty state */
                profileData?.exams?.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 space-y-3">
                    <BookOpen className="w-8 h-8 text-surface-400 mx-auto" />
                    <p className="text-xs text-surface-500 dark:text-surface-400 max-w-sm mx-auto">
                      {t('students.noExamsAssigned') || 'This student is not in any category with exams yet.'}
                    </p>
                    <button
                      onClick={startEdit}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-primary-600 text-white hover:bg-primary-700 cursor-pointer"
                    >
                      {t('students.assignCategories') || 'Assign Category'}
                    </button>
                  </div>
                ) : (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-surface-300 dark:border-surface-700 space-y-2">
                    <FilterX className="w-6 h-6 text-surface-400 mx-auto" />
                    <p className="text-xs text-surface-500">
                      {t('students.noExamsFilterMatch') || 'No exams match this filter'}
                    </p>
                    <button
                      onClick={() => {
                        setExamFilter('all');
                        setExamSearch('');
                      }}
                      className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
                    >
                      {t('students.clearFilters') || 'Clear filter'}
                    </button>
                  </div>
                )
              ) : (
                /* Desktop Table View & Mobile Cards View */
                <div className="space-y-3">
                  {/* Desktop Table View (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto rounded-2xl border border-surface-200 dark:border-surface-700">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-100 dark:bg-surface-800/80 text-surface-600 dark:text-surface-400 font-semibold border-b border-surface-200 dark:border-surface-700">
                        <tr>
                          <th className="p-3">{t('students.exam') || 'Exam'}</th>
                          <th className="p-3">{t('students.examLink') || 'Exam Link'}</th>
                          <th className="p-3">{t('students.attemptStatus') || 'Attempt Status'}</th>
                          <th className="p-3">{t('students.scoreResult') || 'Score / Result'}</th>
                          <th className="p-3">{t('students.submitted') || 'Submitted'}</th>
                          <th className="p-3 text-right">{t('students.actions') || 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-200 dark:divide-surface-700/60 bg-surface-50/50 dark:bg-surface-900/50">
                        {visibleExams.map((record) => (
                          <tr key={record.examId} className="hover:bg-surface-100/50 dark:hover:bg-surface-800/40 transition-colors">
                            {/* Exam title & category */}
                            <td className="p-3">
                              <div dir="auto" className="font-bold text-surface-900 dark:text-surface-100">
                                {record.examTitle}
                              </div>
                              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-300">
                                {record.categoryName}
                              </span>
                            </td>

                            {/* Exam Link Status */}
                            <td className="p-3">
                              {record.examStatus === 'published' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                  <LinkIcon className="w-3 h-3" />
                                  <span>{t('students.linkOpen') || 'Open'}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-surface-400">
                                  <Link2Off className="w-3 h-3" />
                                  <span>{t('students.linkClosed') || 'Closed'}</span>
                                </span>
                              )}
                            </td>

                            {/* Student Attempt Status */}
                            <td className="p-3">
                              {record.statusKey === 'not_taken' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-surface-200/80 dark:bg-surface-700/80 text-surface-600 dark:text-surface-300">
                                  <Clock className="w-3.5 h-3.5 text-surface-500" />
                                  <span>{t('students.notTaken') || 'Not Taken Yet'}</span>
                                </span>
                              )}

                              {record.statusKey === 'in_progress' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>{t('students.inProgress') || 'In Progress'}</span>
                                </span>
                              )}

                              {record.statusKey === 'needs_correction' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  <Hourglass className="w-3.5 h-3.5" />
                                  <span>{t('students.awaitingCorrectionStatus') || 'Awaiting Correction'}</span>
                                </span>
                              )}

                              {record.statusKey === 'graded' && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                                    record.passed
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                  }`}
                                >
                                  {record.passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                  <span>{record.passed ? t('students.passed') || 'Passed' : t('students.failed') || 'Failed'}</span>
                                </span>
                              )}
                            </td>

                            {/* Score / Result */}
                            <td className="p-3 font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                              {record.score !== null ? (
                                <span>
                                  {record.score} / {record.totalMarks} ({record.percentage}%)
                                </span>
                              ) : (
                                <span className="text-surface-400 font-normal">—</span>
                              )}
                            </td>

                            {/* Submitted Date */}
                            <td className="p-3 text-surface-500">
                              {record.submittedAt ? (
                                new Intl.DateTimeFormat(activeLocale, {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                }).format(new Date(record.submittedAt))
                              ) : (
                                <span className="text-surface-400">—</span>
                              )}
                            </td>

                            {/* Row Actions */}
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {record.attemptId && (
                                  <button
                                    onClick={() => onOpenGrading(record.attemptId)}
                                    className="px-2.5 py-1 rounded-lg bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 font-semibold text-xs transition-colors cursor-pointer flex items-center gap-1"
                                    title="View Attempt / Grade"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>{t('students.viewOrGrade') || 'View / Grade'}</span>
                                  </button>
                                )}

                                {record.attemptId && (
                                  <button
                                    onClick={() => setRetakeTarget(record)}
                                    className="p-1.5 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                                    title="Allow Retake"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                                  </button>
                                )}

                                {record.attemptId && (
                                  <button
                                    onClick={() => setResetAttemptTarget(record)}
                                    className="p-1.5 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-600 dark:text-surface-300 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                                    title="Reset Attempt"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards View (< 768px) */}
                  <div className="block md:hidden space-y-3">
                    {visibleExams.map((record) => (
                      <div
                        key={record.examId}
                        className="p-4 rounded-2xl bg-surface-100/80 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-700 space-y-3"
                      >
                        {/* Title & Category */}
                        <div className="flex items-start justify-between gap-2">
                          <div dir="auto" className="font-bold text-sm text-surface-900 dark:text-surface-100">
                            {record.examTitle}
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300 shrink-0">
                            {record.categoryName}
                          </span>
                        </div>

                        {/* 2-column label/value grid */}
                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-surface-200/60 dark:border-surface-700/60">
                          <div>
                            <span className="text-surface-400 block text-[11px]">{t('students.attemptStatus') || 'Attempt Status'}</span>
                            {record.statusKey === 'not_taken' && (
                              <span className="font-medium text-surface-600 dark:text-surface-300">{t('students.notTaken') || 'Not Taken Yet'}</span>
                            )}
                            {record.statusKey === 'in_progress' && (
                              <span className="font-medium text-amber-500">{t('students.inProgress') || 'In Progress'}</span>
                            )}
                            {record.statusKey === 'needs_correction' && (
                              <span className="font-medium text-amber-500">{t('students.awaitingCorrectionStatus') || 'Awaiting Correction'}</span>
                            )}
                            {record.statusKey === 'graded' && (
                              <span className={record.passed ? 'font-semibold text-emerald-500' : 'font-semibold text-rose-500'}>
                                {record.passed ? (t('students.passed') || 'Passed') : (t('students.failed') || 'Failed')}
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-surface-400 block text-[11px]">{t('students.score') || 'Score'}</span>
                            <span className="font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                              {record.score !== null ? `${record.score}/${record.totalMarks} (${record.percentage}%)` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Mobile Actions */}
                        {record.attemptId && (
                          <div className="flex items-center gap-2 pt-2 border-t border-surface-200/60 dark:border-surface-700/60">
                            <button
                              onClick={() => onOpenGrading(record.attemptId)}
                              className="flex-1 py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t('students.viewOrGrade') || 'View / Grade'}</span>
                            </button>

                            <button
                              onClick={() => setRetakeTarget(record)}
                              className="py-2 px-3 rounded-xl bg-surface-200 dark:bg-surface-700 text-amber-600 dark:text-amber-400 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              {t('students.retake') || 'Retake'}
                            </button>

                            <button
                              onClick={() => setResetAttemptTarget(record)}
                              className="py-2 px-3 rounded-xl bg-surface-200 dark:bg-surface-700 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Reset
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Show More Pagination Button */}
                  {filteredExams.length > visibleCount && (
                    <div className="pt-2 text-center">
                      <button
                        onClick={() => setVisibleCount((prev) => prev + 10)}
                        className="px-4 py-2 rounded-xl bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 text-xs font-semibold text-surface-700 dark:text-surface-300 transition-colors cursor-pointer"
                      >
                        Show More ({filteredExams.length - visibleCount} remaining)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Dialog for Deactivate/Activate */}
      <ConfirmDialog
        isOpen={deactivateConfirm}
        onClose={() => setDeactivateConfirm(false)}
        onConfirm={handleToggleActive}
        title={student?.isActive ? t('students.deactivateStudent') || 'Deactivate Student' : t('students.activateStudent') || 'Activate Student'}
        message={
          student?.isActive
            ? t('students.deactivateMessage', { name: student?.fullName }) || `Deactivate ${student?.fullName}?`
            : t('students.activateMessage', { name: student?.fullName }) || `Activate ${student?.fullName}?`
        }
        confirmText={student?.isActive ? t('common.inactive') || 'Deactivate' : t('common.active') || 'Activate'}
        variant={student?.isActive ? 'danger' : 'primary'}
        loading={actionLoading}
      />

      {/* Confirmation Dialog for Delete */}
      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDeleteStudent}
        title={t('students.deleteStudent') || 'Delete Student'}
        message={t('students.deleteConfirmMessage', { name: student?.fullName }) || `Delete ${student?.fullName}?`}
        confirmText={t('common.delete') || 'Delete'}
        variant="danger"
        loading={actionLoading}
      />

      {/* Password Reset Result Modal */}
      <Modal
        isOpen={Boolean(resetPasswordResult)}
        onClose={() => setResetPasswordResult(null)}
        title="Password Reset Successful"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-surface-600 dark:text-surface-300">
            The password for <strong className="text-surface-900 dark:text-surface-100">{student?.fullName}</strong> has been reset. Please copy and share it securely:
          </p>

          <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 flex items-center justify-between font-mono text-sm font-bold text-primary-600 dark:text-primary-400">
            <span>{resetPasswordResult}</span>
            <button
              onClick={() => handleCopy(resetPasswordResult, 'newPassword')}
              className="px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-sans font-semibold transition-colors cursor-pointer flex items-center gap-1"
            >
              {copiedKey === 'newPassword' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === 'newPassword' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirm Allow Retake */}
      <ConfirmDialog
        isOpen={Boolean(retakeTarget)}
        onClose={() => setRetakeTarget(null)}
        onConfirm={handleAllowRetake}
        title="Allow Exam Retake"
        message={`Allow ${student?.fullName} to retake "${retakeTarget?.examTitle}"?`}
        confirmText="Allow Retake"
        variant="primary"
        loading={actionLoading}
      />

      {/* Confirm Reset Attempt */}
      <ConfirmDialog
        isOpen={Boolean(resetAttemptTarget)}
        onClose={() => setResetAttemptTarget(null)}
        onConfirm={handleResetAttempt}
        title="Reset Exam Attempt"
        message={`Are you sure you want to reset ${student?.fullName}'s attempt for "${resetAttemptTarget?.examTitle}"? All recorded answers will be permanently deleted.`}
        confirmText="Reset Attempt"
        variant="danger"
        loading={actionLoading}
      />
    </>
  );
}
