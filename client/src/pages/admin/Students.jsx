import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/client';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Modal, { ConfirmDialog } from '../../components/Modal';
import Spinner, { LoadingScreen } from '../../components/Spinner';
import { EmptyState, ErrorState, Badge } from '../../components/Common';
import Toast from '../../components/Toast';
import { downloadExcelFile } from '../../utils/excelUtils';
import StudentProfileModal from '../../components/admin/StudentProfileModal';
import ComposeEmailModal from '../../components/admin/ComposeEmailModal';
import {
  UserPlus,
  Mail,
  MoreVertical,
  Search,
  X,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit3,
  KeyRound,
  UserX,
  UserCheck,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

// Generate random secure readable password
function generateRandomPassword(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

// Deterministic initials avatar style
const AVATAR_COLORS = [
  { bg: 'bg-teal-500/15', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/30' },
  { bg: 'bg-indigo-500/15', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30' },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30' },
  { bg: 'bg-violet-500/15', text: 'text-violet-600 dark:text-violet-400', border: 'border-violet-500/30' },
  { bg: 'bg-rose-500/15', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30' },
];

function getAvatarStyle(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'ST';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function Students() {
  const { t, i18n } = useTranslation();
  const activeLocale = i18n.language || 'en';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Primary data states
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  // Filters & Search & Sorting
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('studentId');
  const [sortOrder, setSortOrder] = useState('asc');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Selections
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [isSelectAllMatching, setIsSelectAllMatching] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);

  // Header "More" dropdown
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef(null);

  // Row "More" dropdown menu tracking
  const [rowMenuOpenId, setRowMenuOpenId] = useState(null);
  const rowMenuRef = useRef(null);

  // Modals & Action Targets
  const [showAddModal, setShowAddModal] = useState(false);
  const [editStudentTarget, setEditStudentTarget] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState(null); // { student, password }
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Student Profile & Email Modal states
  const [selectedStudentDetailId, setSelectedStudentDetailId] = useState(null);
  const [emailModalConfig, setEmailModalConfig] = useState(null); // { targetType, selectedStudentIds, recipientsCount }

  // Copy state tracker
  const [copiedId, setCopiedId] = useState(null);

  // Forms
  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', gender: 'male' });
  const [formLoading, setFormLoading] = useState(false);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setHeaderMenuOpen(false);
      }
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target)) {
        setRowMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync ?student=<id> query param
  useEffect(() => {
    const sId = searchParams.get('student');
    if (sId) {
      setSelectedStudentDetailId(sId);
    }
  }, [searchParams]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch Students
  const fetchStudents = useCallback(
    async (page = 1, limitOverride) => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          page,
          limit: limitOverride || pagination.limit,
          search: debouncedSearch || undefined,
          gender: selectedGenderFilter || undefined,
          active: selectedStatusFilter === 'all' ? undefined : selectedStatusFilter,
          sortBy,
          sortOrder,
        };
        const { data } = await api.get('/api/users', { params });
        setStudents(data.users || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      } catch (err) {
        setError(err.response?.data?.error || t('errors.GENERIC'));
      } finally {
        setLoading(false);
      }
    },
    [pagination.limit, debouncedSearch, selectedGenderFilter, selectedStatusFilter, sortBy, sortOrder, t]
  );

  useEffect(() => {
    fetchStudents(1);
  }, [fetchStudents]);

  // Clear selections when page/filters change
  useEffect(() => {
    setSelectedStudentIds([]);
    setIsSelectAllMatching(false);
  }, [debouncedSearch, selectedGenderFilter, selectedStatusFilter, pagination.page]);

  // Active Filter Count & Status
  const hasActiveFilters = Boolean(
    debouncedSearch || selectedGenderFilter || (selectedStatusFilter && selectedStatusFilter !== 'all')
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (debouncedSearch) count++;
    if (selectedGenderFilter) count++;
    if (selectedStatusFilter && selectedStatusFilter !== 'all') count++;
    return count;
  }, [debouncedSearch, selectedGenderFilter, selectedStatusFilter]);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedGenderFilter('');
    setSelectedStatusFilter('all');
  };

  // Sort Handler
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Copy Student ID
  const handleCopyId = (e, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Selection toggles
  const isPageAllSelected = useMemo(
    () => students.length > 0 && students.every((s) => selectedStudentIds.includes(s._id)),
    [students, selectedStudentIds]
  );

  const toggleSelectPage = () => {
    if (isPageAllSelected) {
      setSelectedStudentIds([]);
      setIsSelectAllMatching(false);
    } else {
      setSelectedStudentIds(students.map((s) => s._id));
    }
  };

  const toggleSelectStudent = (e, id) => {
    if (e) e.stopPropagation();
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setIsSelectAllMatching(false);
  };

  // Add Student Handler
  const handleAddStudent = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const { data } = await api.post('/api/users', formData);
      setShowAddModal(false);
      setFormData({ fullName: '', email: '', password: '', gender: 'male' });
      setResetPasswordTarget({
        student: data.user,
        password: data.generatedPassword,
      });
      setToast({ message: t('common.save') + ' success', type: 'success' });
      fetchStudents(pagination.page);
    } catch (err) {
      setToast({ message: err.response?.data?.error || t('errors.GENERIC'), type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  // Edit Student Handler
  const handleEditStudent = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const payload = {
        fullName: formData.fullName,
        email: formData.email,
        gender: formData.gender,
      };
      if (formData.password && formData.password.trim()) {
        payload.password = formData.password.trim();
      }
      await api.put(`/api/users/${editStudentTarget._id}`, payload);
      const updatedPassword = formData.password && formData.password.trim();
      const targetStudent = editStudentTarget;
      setEditStudentTarget(null);
      if (updatedPassword) {
        setResetPasswordTarget({
          student: targetStudent,
          password: updatedPassword,
        });
      }
      setToast({ message: t('common.save') + ' success', type: 'success' });
      fetchStudents(pagination.page);
    } catch (err) {
      setToast({ message: err.response?.data?.error || t('errors.GENERIC'), type: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  // Deactivate/Activate Handler
  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await api.patch(`/api/users/${deactivateTarget._id}/deactivate`);
      setToast({
        message: deactivateTarget.isActive ? t('students.deactivateStudent') : t('students.activateStudent'),
        type: 'success',
      });
      setDeactivateTarget(null);
      fetchStudents(pagination.page);
    } catch (err) {
      setToast({ message: err.response?.data?.error || t('errors.GENERIC'), type: 'error' });
    }
  };

  // Delete Student Handler
  const handleDeleteStudent = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/api/users/${deleteTarget._id}`);
      setToast({ message: t('students.deleteStudent') + ' success', type: 'success' });
      setDeleteTarget(null);
      fetchStudents(pagination.page);
    } catch (err) {
      setToast({ message: err.response?.data?.error || t('errors.GENERIC'), type: 'error' });
    }
  };

  // Single Password Reset
  const handleResetPassword = async (student) => {
    try {
      const { data } = await api.post(`/api/users/${student._id}/reset-password`);
      setResetPasswordTarget({
        student,
        password: data.generatedPassword,
      });
    } catch (err) {
      setToast({ message: err.response?.data?.error || t('errors.GENERIC'), type: 'error' });
    }
  };

  // Bulk Actions Handlers
  const handleBulkAction = async (action, extraData = {}) => {
    try {
      const targetIds = isSelectAllMatching ? undefined : selectedStudentIds;
      const { data } = await api.post('/api/users/bulk-action', {
        action,
        userIds: targetIds,
        selectAll: isSelectAllMatching,
        filter: isSelectAllMatching
          ? {
              search: debouncedSearch || undefined,
              gender: selectedGenderFilter || undefined,
              active: selectedStatusFilter === 'all' ? undefined : selectedStatusFilter,
            }
          : undefined,
        ...extraData,
      });

      setSelectedStudentIds([]);
      setIsSelectAllMatching(false);
      setShowBulkAssignModal(false);
      setToast({ message: data.message || 'Bulk action completed', type: 'success' });
      fetchStudents(pagination.page);
    } catch (err) {
      setToast({ message: err.response?.data?.error || t('errors.GENERIC'), type: 'error' });
    }
  };

  // Export Excel
  const handleExportExcel = async () => {
    try {
      const res = await api.get('/api/users', { params: { limit: 1000 } });
      const exportData = (res.data.users || []).map((u) => ({
        'Student ID': u.studentId || '',
        'Full Name': u.fullName || '',
        Email: u.email || '',
        Gender: u.gender || '',
        Status: u.isActive ? 'Active' : 'Inactive',
        Joined: new Date(u.createdAt).toLocaleDateString(),
      }));
      downloadExcelFile('Students_Export.xlsx', exportData);
    } catch (err) {
      setToast({ message: 'Failed to export Excel file', type: 'error' });
    }
  };

  // Download Import Template
  const handleDownloadTemplate = () => {
    const templateData = [
      { studentId: 'STU-01', fullName: 'Example Student', gender: 'male', email: 'student@example.com' },
    ];
    downloadExcelFile('Student_Import_Template.xlsx', templateData);
  };

  return (
    <div className="animate-fade-in space-y-5 pb-20">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-surface-100 tracking-tight">
            {t('students.title') || 'Students'}
          </h1>
          <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            {t('students.showingResults', {
              from: (pagination.page - 1) * pagination.limit + (students.length > 0 ? 1 : 0),
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            }) || `${pagination.total} students total`}
          </p>
        </div>

        {/* Action button row */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Add Student Primary Button */}
          <Button
            size="sm"
            onClick={() => {
              const generated = generateRandomPassword();
              setFormData({ fullName: '', email: '', password: generated, gender: 'male' });
              setShowAddModal(true);
            }}
            className="flex-1 sm:flex-initial gap-2 text-xs py-2.5"
          >
            <UserPlus className="w-4 h-4 stroke-[1.75]" />
            <span>{t('students.addStudent') || 'Add Student'}</span>
          </Button>

          {/* Announcement Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setEmailModalConfig({
                targetType: 'all',
                selectedStudentIds: [],
                recipientsCount: pagination.total,
              })
            }
            className="hidden sm:inline-flex gap-2 text-xs py-2.5"
            title={t('students.sendEmailAnnouncement')}
          >
            <Mail className="w-4 h-4 stroke-[1.75]" />
            <span>{t('students.announcement') || 'Announcement'}</span>
          </Button>

          {/* Mobile Icon-Only Announcement button */}
          <button
            onClick={() =>
              setEmailModalConfig({
                targetType: 'all',
                selectedStudentIds: [],
                recipientsCount: pagination.total,
              })
            }
            className="sm:hidden p-2.5 rounded-xl bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300 min-w-[42px] min-h-[42px] flex items-center justify-center cursor-pointer"
            aria-label="Send Email Announcement"
            title={t('students.sendEmailAnnouncement')}
          >
            <Mail className="w-4.5 h-4.5 stroke-[1.75]" />
          </button>

          {/* "More" (⋯) Dropdown Menu */}
          <div className="relative" ref={headerMenuRef}>
            <button
              onClick={() => setHeaderMenuOpen((prev) => !prev)}
              className="p-2.5 rounded-xl bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 transition-colors cursor-pointer min-w-[42px] min-h-[42px] flex items-center justify-center"
              aria-label="More options"
              title={t('students.moreActions')}
            >
              <MoreVertical className="w-4.5 h-4.5 stroke-[1.75]" />
            </button>

            {headerMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 rounded-2xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-xl py-1.5 z-50 animate-pop-in">
                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    setShowImportModal(true);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-surface-800 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700/60 flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 stroke-[1.75]" />
                  <span>{t('students.importExcel') || 'Import from Excel'}</span>
                </button>

                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    handleExportExcel();
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-surface-800 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700/60 flex items-center gap-2.5 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 text-indigo-500 stroke-[1.75]" />
                  <span>{t('students.exportExcel') || 'Export to Excel'}</span>
                </button>

                <button
                  onClick={() => {
                    setHeaderMenuOpen(false);
                    handleDownloadTemplate();
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-surface-800 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700/60 flex items-center gap-2.5 cursor-pointer transition-colors border-t border-surface-200 dark:border-surface-700/60"
                >
                  <FileText className="w-4 h-4 text-amber-500 stroke-[1.75]" />
                  <span>{t('students.downloadTemplate') || 'Download Import Template'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Filter Toolbar */}
      <div className="glass-card p-3.5 rounded-2xl border border-surface-200/80 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/60 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-2.5">
          {/* Search bar with Lucide icon and clear button */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 stroke-[1.75]" />
            <input
              type="text"
              dir="auto"
              placeholder={t('common.search') || 'Search name, ID, email...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-xl bg-surface-100 dark:bg-surface-800/80 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 cursor-pointer min-w-[24px] min-h-[24px] flex items-center justify-center"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5 stroke-[1.75]" />
              </button>
            )}
          </div>

          {/* Desktop Filters Dropdowns */}
          <div className="hidden md:flex items-center gap-2 w-full md:w-auto">

            {/* Gender Filter */}
            <select
              value={selectedGenderFilter}
              onChange={(e) => setSelectedGenderFilter(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-100 dark:bg-surface-800/80 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="">{t('students.allGenders') || 'All Genders'}</option>
              <option value="male">{t('students.male') || 'Male'}</option>
              <option value="female">{t('students.female') || 'Female'}</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-surface-100 dark:bg-surface-800/80 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="all">{t('students.filterByStatus') || 'All Statuses'}</option>
              <option value="true">{t('common.active') || 'Active'}</option>
              <option value="false">{t('common.inactive') || 'Inactive'}</option>
            </select>
          </div>

          {/* Mobile Filter Sheet Trigger */}
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="md:hidden flex items-center gap-2 w-full justify-center py-2 px-3 text-xs font-semibold rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-800 dark:text-surface-200"
          >
            <Filter className="w-3.5 h-3.5 stroke-[1.75]" />
            <span>{t('students.filters') || 'Filters'}</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Active Filters Metadata Bar & Removable Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-surface-500 pt-2 border-t border-surface-200/60 dark:border-surface-800">
            <div className="flex flex-wrap items-center gap-1.5">
              <span>{t('students.foundResults', { count: pagination.total }) || `Found ${pagination.total} results`}</span>

              {debouncedSearch && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-primary-500/15 text-primary-600 dark:text-primary-300">
                  Search: "{debouncedSearch}"
                  <button onClick={() => setSearch('')} className="hover:text-rose-500"><X className="w-3 h-3" /></button>
                </span>
              )}

              {selectedGenderFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-primary-500/15 text-primary-600 dark:text-primary-300">
                  Gender: {selectedGenderFilter}
                  <button onClick={() => setSelectedGenderFilter('')} className="hover:text-rose-500"><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>

            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer ml-auto"
            >
              {t('students.clearFilters') || 'Clear filters'}
            </button>
          </div>
        )}
      </div>

      {/* 3. Floating Bulk Selection Action Bar */}
      {selectedStudentIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-primary-600 text-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl animate-pop-in">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span>{selectedStudentIds.length} student(s) selected on page</span>
            {!isSelectAllMatching && pagination.total > selectedStudentIds.length && (
              <button
                onClick={() => setIsSelectAllMatching(true)}
                className="text-primary-100 underline hover:text-white transition-colors cursor-pointer"
              >
                {t('students.selectAllMatching', { total: pagination.total }) || `Select all ${pagination.total} matching`}
              </button>
            )}
            {isSelectAllMatching && (
              <span className="px-2 py-0.5 rounded-full bg-primary-700 text-white text-[11px]">
                All {pagination.total} matching selected
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 w-full sm:w-auto">
            <button
              onClick={() =>
                setEmailModalConfig({
                  targetType: 'selected',
                  selectedStudentIds,
                  recipientsCount: selectedStudentIds.length,
                })
              }
              className="px-3 py-1.5 rounded-xl bg-white text-primary-700 text-xs font-bold hover:bg-primary-50 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 stroke-[1.75]" />
              <span>{t('students.announcement') || 'Announcement'}</span>
            </button>

            <button
              onClick={() => handleBulkAction('activate')}
              className="px-2.5 py-1.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-xs font-medium cursor-pointer"
            >
              Activate
            </button>

            <button
              onClick={() => handleBulkAction('deactivate')}
              className="px-2.5 py-1.5 rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-xs font-medium cursor-pointer"
            >
              Deactivate
            </button>

            <button
              onClick={() => handleBulkAction('delete')}
              className="px-2.5 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-medium cursor-pointer"
            >
              Delete
            </button>

            <button
              onClick={() => {
                setSelectedStudentIds([]);
                setIsSelectAllMatching(false);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-primary-800 text-primary-200 hover:text-white text-xs font-medium cursor-pointer ml-1"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 4. Main Table & Card Views */}
      {loading ? (
        /* Skeleton loading rows */
        <div className="glass-card rounded-2xl border border-surface-200 dark:border-surface-800 p-4 space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-xl bg-surface-100 dark:bg-surface-800/60" />
          ))}
        </div>
      ) : students.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="w-8 h-8 text-surface-400 stroke-[1.75]" />}
          title={t('students.noStudentsTitle') || 'No students found'}
          message={t('students.noStudentsMessage') || 'No student accounts match your search or filters.'}
          action={
            hasActiveFilters ? (
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                {t('students.clearFilters') || 'Clear filters'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setFormData({ fullName: '', email: '', password: generateRandomPassword(), gender: 'male' });
                  setShowAddModal(true);
                }}
              >
                ➕ {t('students.addStudent') || 'Add Student'}
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop & Tablet Table (>= 768px) */}
          <div className="hidden md:block glass-card overflow-hidden rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/60 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-10 bg-surface-100/90 dark:bg-surface-800/90 backdrop-blur-md text-surface-600 dark:text-surface-400 font-semibold border-b border-surface-200 dark:border-surface-800 select-none">
                  <tr>
                    <th className="py-3 px-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={isPageAllSelected}
                        onChange={toggleSelectPage}
                        className="rounded border-surface-300 dark:border-surface-700 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      />
                    </th>

                    {/* Student ID (Sortable numerically) */}
                    <th
                      aria-sort={sortBy === 'studentId' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                      onClick={() => handleSort('studentId')}
                      className="py-3 px-3.5 cursor-pointer hover:text-surface-900 dark:hover:text-surface-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{t('students.studentId') || 'Student ID'}</span>
                        {sortBy === 'studentId' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary-500" /> : <ChevronDown className="w-3.5 h-3.5 text-primary-500" />
                        ) : null}
                      </div>
                    </th>

                    {/* Full Name (Sortable) */}
                    <th
                      aria-sort={sortBy === 'fullName' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                      onClick={() => handleSort('fullName')}
                      className="py-3 px-3.5 cursor-pointer hover:text-surface-900 dark:hover:text-surface-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{t('students.fullName') || 'Student'}</span>
                        {sortBy === 'fullName' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary-500" /> : <ChevronDown className="w-3.5 h-3.5 text-primary-500" />
                        ) : null}
                      </div>
                    </th>

                    <th className="py-3 px-3.5">{t('students.gender') || 'Gender'}</th>

                    {/* Status (Sortable) */}
                    <th
                      aria-sort={sortBy === 'isActive' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                      onClick={() => handleSort('isActive')}
                      className="py-3 px-3.5 cursor-pointer hover:text-surface-900 dark:hover:text-surface-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{t('common.status') || 'Status'}</span>
                        {sortBy === 'isActive' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary-500" /> : <ChevronDown className="w-3.5 h-3.5 text-primary-500" />
                        ) : null}
                      </div>
                    </th>

                    {/* Joined Date (Sortable, hidden below 1024px) */}
                    <th
                      aria-sort={sortBy === 'createdAt' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                      onClick={() => handleSort('createdAt')}
                      className="hidden lg:table-cell py-3 px-3.5 cursor-pointer hover:text-surface-900 dark:hover:text-surface-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{t('students.joined') || 'Joined'}</span>
                        {sortBy === 'createdAt' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-primary-500" /> : <ChevronDown className="w-3.5 h-3.5 text-primary-500" />
                        ) : null}
                      </div>
                    </th>

                    <th className="py-3 px-3.5 text-right">{t('common.actions') || 'Actions'}</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-surface-200 dark:divide-surface-800">
                  {students.map((student) => {
                    const isSelected = selectedStudentIds.includes(student._id);
                    const avatarStyle = getAvatarStyle(student.studentId || student._id);
                    const initials = getInitials(student.fullName);

                    return (
                      <tr
                        key={student._id}
                        tabIndex={0}
                        onClick={() => setSelectedStudentDetailId(student._id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary-50/60 dark:bg-primary-950/20'
                            : 'hover:bg-surface-100/60 dark:hover:bg-surface-800/40'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => toggleSelectStudent(e, student._id)}
                            className="rounded border-surface-300 dark:border-surface-700 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                        </td>

                        {/* Monospace Student ID chip with copy button */}
                        <td className="py-3 px-3.5" onClick={(e) => e.stopPropagation()}>
                          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-surface-200/80 dark:bg-surface-800 text-surface-800 dark:text-surface-200 border border-surface-300/60 dark:border-surface-700/60">
                            <span>{student.studentId}</span>
                            <button
                              onClick={(e) => handleCopyId(e, student.studentId)}
                              className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer"
                              title={t('students.copyStudentId')}
                            >
                              {copiedId === student.studentId ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-surface-400" />
                              )}
                            </button>
                          </span>
                        </td>

                        {/* Full Name & Initials Avatar + Email */}
                        <td className="py-3 px-3.5 font-medium text-surface-900 dark:text-surface-100" dir="auto">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-xl ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border} border flex items-center justify-center font-bold text-[11px] shrink-0`}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-surface-900 dark:text-surface-100 hover:text-primary-600 dark:hover:text-primary-400 truncate">
                                {student.fullName}
                              </div>
                              {student.email ? (
                                <div className="text-[11px] text-surface-500 dark:text-surface-400 truncate font-mono">
                                  {student.email}
                                </div>
                              ) : (
                                <div className="text-[11px] text-rose-500 dark:text-rose-400 italic flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                                  <span>{t('students.noEmail')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Gender (Neutral badge) */}
                        <td className="py-3 px-3.5">
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-200/80 dark:bg-surface-800 text-surface-700 dark:text-surface-300 capitalize">
                            {student.gender ? t(`students.${student.gender}`) || student.gender : '—'}
                          </span>
                        </td>

                        {/* Status (Dot + Text) */}
                        <td className="py-3 px-3.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              student.isActive
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${student.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span>{student.isActive ? t('common.active') || 'Active' : t('common.inactive') || 'Inactive'}</span>
                          </span>
                        </td>

                        {/* Joined Date (Hidden below 1024px) */}
                        <td className="hidden lg:table-cell py-3 px-3.5 text-surface-500 dark:text-surface-400" title={new Date(student.createdAt).toLocaleString(activeLocale)}>
                          {new Intl.DateTimeFormat(activeLocale, { dateStyle: 'medium' }).format(new Date(student.createdAt))}
                        </td>

                        {/* Row Actions Column */}
                        <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            {/* View Profile */}
                            <button
                              onClick={() => setSelectedStudentDetailId(student._id)}
                              aria-label="View profile"
                              title={t('students.viewProfile')}
                              className="p-1.5 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                            >
                              <Eye className="w-4 h-4 stroke-[1.75]" />
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => {
                                setEditStudentTarget(student);
                                setFormData({
                                  studentId: student.studentId,
                                  fullName: student.fullName,
                                  email: student.email || '',
                                  password: '',
                                  gender: student.gender || 'male',
                                });
                              }}
                              aria-label="Edit student"
                              title={t('students.editStudent')}
                              className="p-1.5 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                            >
                              <Edit3 className="w-4 h-4 stroke-[1.75]" />
                            </button>

                            {/* Row More Menu Dropdown */}
                            <div className="relative" ref={rowMenuOpenId === student._id ? rowMenuRef : null}>
                              <button
                                onClick={() => setRowMenuOpenId((prev) => (prev === student._id ? null : student._id))}
                                aria-label="More row options"
                                title={t('students.moreActions')}
                                className="p-1.5 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors cursor-pointer min-w-[32px] min-h-[32px] flex items-center justify-center"
                              >
                                <MoreVertical className="w-4 h-4 stroke-[1.75]" />
                              </button>

                              {rowMenuOpenId === student._id && (
                                <div className="absolute right-0 mt-1 w-44 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shadow-xl py-1 z-50 animate-pop-in text-left">
                                  <button
                                    onClick={() => {
                                      setRowMenuOpenId(null);
                                      setEmailModalConfig({
                                        targetType: 'selected',
                                        selectedStudentIds: [student._id],
                                        recipientsCount: 1,
                                      });
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-surface-800 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700/60 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Mail className="w-3.5 h-3.5 text-primary-500 stroke-[1.75]" />
                                    <span>{t('students.sendEmail')}</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setRowMenuOpenId(null);
                                      handleResetPassword(student);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-surface-800 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700/60 flex items-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <KeyRound className="w-3.5 h-3.5 text-amber-500 stroke-[1.75]" />
                                    <span>{t('students.resetPassword')}</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setRowMenuOpenId(null);
                                      setDeactivateTarget(student);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-surface-800 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700/60 flex items-center gap-2 cursor-pointer transition-colors border-t border-surface-200 dark:border-surface-700/60"
                                  >
                                    {student.isActive ? (
                                      <>
                                        <UserX className="w-3.5 h-3.5 text-rose-500 stroke-[1.75]" />
                                        <span>{t('students.deactivate')}</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-500 stroke-[1.75]" />
                                        <span>{t('students.activate')}</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    onClick={() => {
                                      setRowMenuOpenId(null);
                                      setDeleteTarget(student);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer transition-colors border-t border-surface-200 dark:border-surface-700/60"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 stroke-[1.75]" />
                                    <span>{t('common.delete')}</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-3.5 bg-surface-100/60 dark:bg-surface-800/40 border-t border-surface-200 dark:border-surface-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-surface-600 dark:text-surface-400">
              <div className="flex items-center gap-2">
                <span>{t('students.rowsPerPage') || 'Rows per page'}:</span>
                <select
                  value={pagination.limit}
                  onChange={(e) => fetchStudents(1, Number(e.target.value))}
                  className="px-2 py-1 rounded-lg bg-surface-200 dark:bg-surface-700 border border-surface-300 dark:border-surface-600 text-surface-900 dark:text-surface-100 font-semibold"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <span>
                  {t('students.showingResults', {
                    from: (pagination.page - 1) * pagination.limit + (students.length > 0 ? 1 : 0),
                    to: Math.min(pagination.page * pagination.limit, pagination.total),
                    total: pagination.total,
                  }) || `Showing ${pagination.total} results`}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchStudents(pagination.page - 1)}
                    className="p-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 disabled:opacity-40 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
                  </button>
                  <span className="font-semibold px-2">{pagination.page} / {pagination.pages || 1}</span>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => fetchStudents(pagination.page + 1)}
                    className="p-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 disabled:opacity-40 hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[1.75]" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Card View (< 768px) */}
          <div className="block md:hidden space-y-3">
            {students.map((student) => {
              const isSelected = selectedStudentIds.includes(student._id);
              const avatarStyle = getAvatarStyle(student.studentId || student._id);
              const initials = getInitials(student.fullName);

              return (
                <div
                  key={student._id}
                  onClick={() => setSelectedStudentDetailId(student._id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50/30 dark:bg-primary-950/20 shadow-md'
                      : 'border-surface-200 dark:border-surface-800 bg-surface-50/60 dark:bg-surface-900/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectStudent(e, student._id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-surface-300 text-primary-600 focus:ring-primary-500 shrink-0"
                      />
                      <div
                        className={`w-9 h-9 rounded-xl ${avatarStyle.bg} ${avatarStyle.text} ${avatarStyle.border} border flex items-center justify-center font-bold text-xs shrink-0`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-surface-900 dark:text-surface-100 truncate" dir="auto">
                          {student.fullName}
                        </div>
                        <span className="font-mono text-xs text-surface-500 font-semibold">{student.studentId}</span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        student.isActive
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {student.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* 2-column label/value grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-surface-200/60 dark:border-surface-800">

                    <div>
                      <span className="text-[11px] text-surface-400 block">{t('students.gender') || 'Gender'}</span>
                      <span className="font-medium text-surface-800 dark:text-surface-200 capitalize block">
                        {student.gender ? t(`students.${student.gender}`) || student.gender : 'Unspecified'}
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className="text-[11px] text-surface-400 block">{t('students.email') || 'Email'}</span>
                      {student.email ? (
                        <span className="font-mono text-xs text-primary-600 dark:text-primary-400 break-words block">
                          {student.email}
                        </span>
                      ) : (
                        <span className="text-xs text-rose-500 dark:text-rose-400 italic flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span>{t('students.noEmailSet')}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Card Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-surface-200/60 dark:border-surface-800" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setSelectedStudentDetailId(student._id)}
                      className="flex-1 py-2 px-3 rounded-xl bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>{t('students.viewProfile')}</span>
                    </button>

                    <button
                      onClick={() => {
                        setEmailModalConfig({
                          targetType: 'selected',
                          selectedStudentIds: [student._id],
                          recipientsCount: 1,
                        });
                      }}
                      className="py-2 px-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 stroke-[1.75]" />
                      <span>{t('students.email')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Mobile Filters Drawer Sheet */}
      <Modal isOpen={mobileFilterOpen} onClose={() => setMobileFilterOpen(false)} title={t('students.filterStudents')} size="sm">
        <div className="space-y-4">

          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
              {t('students.gender')}
            </label>
            <select
              value={selectedGenderFilter}
              onChange={(e) => setSelectedGenderFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100"
            >
              <option value="">{t('students.allGenders')}</option>
              <option value="male">{t('students.male')}</option>
              <option value="female">{t('students.female')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
              {t('common.status')}
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100"
            >
              <option value="all">{t('students.allStatuses')}</option>
              <option value="true">{t('common.active')}</option>
              <option value="false">{t('common.inactive')}</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
            <button
              onClick={() => {
                clearFilters();
                setMobileFilterOpen(false);
              }}
              className="text-xs font-semibold text-surface-500 hover:text-surface-900 dark:hover:text-surface-100"
            >
              {t('students.clearAll')}
            </button>
            <Button size="sm" onClick={() => setMobileFilterOpen(false)}>
              {t('students.applyFilters')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 6. Add Student Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={t('students.addNewStudent')}>
        <form onSubmit={handleAddStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">{t('students.fullNameRequired')}</label>
            <Input
              type="text"
              required
              dir="auto"
              value={formData.fullName}
              onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
              placeholder="e.g. Abebe Bikila"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">{t('students.emailAddress')}</label>
            <Input
              type="email"
              dir="auto"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="student@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400">{t('students.passwordRequired')}</label>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, password: generateRandomPassword() }))}
                className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{t('students.generateNew')}</span>
              </button>
            </div>
            <Input
              type="text"
              required
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              placeholder={t('students.enterOrGeneratePassword')}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">{t('students.gender')}</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100"
            >
              <option value="male">{t('students.male')}</option>
              <option value="female">{t('students.female')}</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setShowAddModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" type="submit" disabled={formLoading}>
              {t('students.saveStudent')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 7. Edit Student Modal */}
      <Modal isOpen={Boolean(editStudentTarget)} onClose={() => setEditStudentTarget(null)} title={t('students.editStudent')}>
        <form onSubmit={handleEditStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">{t('students.fullNameRequired')}</label>
            <Input
              type="text"
              required
              dir="auto"
              value={formData.fullName}
              onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">{t('students.emailAddress')}</label>
            <Input
              type="email"
              dir="auto"
              value={formData.email}
              onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-surface-600 dark:text-surface-400">{t('students.newPassword')}</label>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, password: generateRandomPassword() }))}
                className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{t('students.generateNew')}</span>
              </button>
            </div>
            <Input
              type="text"
              value={formData.password}
              onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
              placeholder={t('students.leaveEmptyKeepCurrent')}
              className="font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">{t('students.gender')}</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100"
            >
              <option value="male">{t('students.male')}</option>
              <option value="female">{t('students.female')}</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" type="button" onClick={() => setEditStudentTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" type="submit" disabled={formLoading}>
              {t('common.saveChanges')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 8. Deactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deactivateTarget)}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title={deactivateTarget?.isActive ? t('students.deactivateStudent') : t('students.activateStudent')}
        message={
          deactivateTarget?.isActive
            ? t('students.deactivateMessage', { name: deactivateTarget?.fullName })
            : t('students.activateMessage', { name: deactivateTarget?.fullName })
        }
        confirmText={deactivateTarget?.isActive ? t('students.deactivate') : t('students.activate')}
        variant={deactivateTarget?.isActive ? 'danger' : 'primary'}
      />

      {/* 9. Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteStudent}
        title={t('students.deleteStudent')}
        message={t('students.deleteConfirmMessage', { name: deleteTarget?.fullName })}
        confirmText={t('common.delete')}
        variant="danger"
      />

      {/* 10. Student Profile & History Modal */}
      {selectedStudentDetailId && (
        <StudentProfileModal
          studentId={selectedStudentDetailId}
          onClose={() => setSelectedStudentDetailId(null)}
          onStudentUpdated={() => fetchStudents(pagination.page)}
          onOpenGrading={(attemptId) => navigate(`/admin/results?attempt=${attemptId}`)}
        />
      )}

      {/* 11. Compose Announcement Email Modal */}
      {emailModalConfig && (
        <ComposeEmailModal
          isOpen={Boolean(emailModalConfig)}
          onClose={() => setEmailModalConfig(null)}
          targetType={emailModalConfig.targetType}
          selectedStudentIds={emailModalConfig.selectedStudentIds}
          recipientsCount={emailModalConfig.recipientsCount}
          onSuccess={() => {
            setToast({ message: t('students.emailSentSuccess'), type: 'success' });
          }}
        />
      )}

      {/* Password Reset Result Modal */}
      <Modal isOpen={Boolean(resetPasswordTarget)} onClose={() => setResetPasswordTarget(null)} title={t('students.credentials')}>
        <div className="space-y-4">
          <p className="text-xs text-surface-600 dark:text-surface-300">
            {t('students.passwordForStudent', { name: resetPasswordTarget?.student?.fullName })}
          </p>
          <div className="p-3 rounded-xl bg-surface-100 dark:bg-surface-800 font-mono text-sm font-bold text-primary-600">
            {resetPasswordTarget?.password}
          </div>
        </div>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
