import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import Modal from '../Modal';
import { Mail, Paperclip, X, Send, AlertCircle, CheckCircle2, FileText, Users, Search } from 'lucide-react';

export default function ComposeEmailModal({
  isOpen,
  onClose,
  targetType: initialTargetType = 'all', // 'all' or 'selected'
  selectedStudentIds: initialSelectedStudentIds = [],
  recipientsCount: initialRecipientsCount = 0,
  onSuccess,
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);

  // Form states
  const [targetType, setTargetType] = useState(initialTargetType);
  const [selectedIds, setSelectedIds] = useState(initialSelectedStudentIds);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);

  // Students list for picker
  const [allStudents, setAllStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Execution states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successResult, setSuccessResult] = useState(null);

  // Sync props when opening
  useEffect(() => {
    if (isOpen) {
      setTargetType(initialTargetType);
      setSelectedIds(initialSelectedStudentIds);
      setError(null);
      setSuccessResult(null);

      // Fetch students list for interactive selection
      setLoadingStudents(true);
      api.get('/api/users', { params: { limit: 100, active: 'true' } })
        .then((res) => {
          const list = res.data.users || [];
          setAllStudents(list);
          // Pre-filter selected IDs to only include students that actually have email addresses
          const validEmailStudentIds = list.filter((s) => Boolean(s.email)).map((s) => s._id);
          setSelectedIds((prev) => prev.filter((id) => validEmailStudentIds.includes(id)));
        })
        .catch(() => {})
        .finally(() => setLoadingStudents(false));
    }
  }, [isOpen, initialTargetType, initialSelectedStudentIds]);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setFiles((prev) => {
      const combined = [...prev, ...selectedFiles];
      if (combined.length > 5) {
        setError('Maximum 5 attached files allowed per email.');
        return combined.slice(0, 5);
      }
      return combined;
    });
    setError(null);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleStudentSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const filteredStudents = allStudents.filter(
    (s) =>
      s.fullName?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.studentId?.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email?.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const eligibleStudents = filteredStudents.filter((s) => Boolean(s.email));

  const toggleSelectAllStudents = () => {
    const allEligibleSelected = eligibleStudents.every((s) => selectedIds.includes(s._id));

    if (allEligibleSelected && eligibleStudents.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleStudents.map((s) => s._id));
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please enter announcement message content.');
      return;
    }

    if (targetType === 'selected' && selectedIds.length === 0) {
      setError('Please select at least one student recipient who has an email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessResult(null);

    try {
      const formData = new FormData();
      formData.append('targetType', targetType);
      formData.append('subject', subject || 'Announcement from Medresa Ustaz');
      formData.append('message', message.trim());
      formData.append('selectedStudentIds', JSON.stringify(selectedIds));

      files.forEach((file) => {
        formData.append('attachments', file);
      });

      const res = await api.post('/api/email/send-announcement', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setSuccessResult(res.data.message || `Announcement sent to ${res.data.sentCount} recipients.`);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          'Failed to send email. Please check your SMTP credentials in Settings or .env.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetAndClose = () => {
    setSubject('');
    setMessage('');
    setFiles([]);
    setError(null);
    setSuccessResult(null);
    onClose();
  };

  if (!isOpen) return null;

  const activeRecipientsCount =
    targetType === 'all'
      ? allStudents.filter((s) => Boolean(s.email)).length || initialRecipientsCount
      : selectedIds.length;

  const titleContent = (
    <div className="flex items-center gap-2">
      <Mail className="w-5 h-5 text-primary-500" />
      <span>{t('students.sendEmailAnnouncement') || 'Send Email Announcement'}</span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={handleResetAndClose} title={titleContent} size="lg">
      {successResult ? (
        <div className="py-8 px-4 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100">
              Email Sent Successfully!
            </h3>
            <p className="text-xs text-surface-600 dark:text-surface-300 max-w-sm mx-auto">
              {successResult}
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetAndClose}
            className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-4">
          {/* Target Selection Switcher */}
          <div className="p-3.5 rounded-xl bg-surface-100 dark:bg-surface-800/80 border border-surface-200 dark:border-surface-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-surface-900 dark:text-surface-100 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary-500" />
                <span>{t('emailModal.selectRecipients', { count: activeRecipientsCount }) || `Select Recipients (${activeRecipientsCount} student(s) with valid email)`}</span>
              </label>
              <span className="text-xs text-surface-400">{t('emailModal.directNotice') || 'Zero DB storage • Direct via Email'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  targetType === 'all'
                    ? 'bg-primary-500/15 border-primary-500 text-primary-600 dark:text-primary-300 ring-2 ring-primary-500/20'
                    : 'bg-surface-50 dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300'
                }`}
              >
                <input
                  type="radio"
                  name="targetType"
                  value="all"
                  checked={targetType === 'all'}
                  onChange={() => setTargetType('all')}
                  className="sr-only"
                />
                <span>{t('emailModal.allStudents') || 'All Active Students'}</span>
              </label>

              <label
                className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  targetType === 'selected'
                    ? 'bg-primary-500/15 border-primary-500 text-primary-600 dark:text-primary-300 ring-2 ring-primary-500/20'
                    : 'bg-surface-50 dark:bg-surface-900 border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300'
                }`}
              >
                <input
                  type="radio"
                  name="targetType"
                  value="selected"
                  checked={targetType === 'selected'}
                  onChange={() => setTargetType('selected')}
                  className="sr-only"
                />
                <span>{t('emailModal.chooseSpecific', { count: selectedIds.length }) || `Choose Specific Students (${selectedIds.length})`}</span>
              </label>
            </div>

            {/* Interactive Student Selector list when targetType === 'selected' */}
            {targetType === 'selected' && (
              <div className="space-y-2 pt-2 border-t border-surface-200 dark:border-surface-700">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      type="text"
                      placeholder={t('emailModal.searchPlaceholder') || "Search students by name, ID, or email..."}
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={toggleSelectAllStudents}
                    className="px-2.5 py-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline shrink-0"
                  >
                    {eligibleStudents.length > 0 && selectedIds.length === eligibleStudents.length
                      ? (t('emailModal.deselectAll') || 'Deselect All')
                      : (t('emailModal.selectAllEligible') || 'Select All Eligible')}
                  </button>
                </div>

                <div className="max-h-40 overflow-y-auto p-2 rounded-xl bg-surface-50 dark:bg-surface-900 border border-surface-300 dark:border-surface-700 space-y-1">
                  {loadingStudents ? (
                    <div className="py-4 text-center text-xs text-surface-400 animate-pulse">
                      {t('emailModal.loadingStudents') || 'Loading students...'}
                    </div>
                  ) : filteredStudents.length === 0 ? (
                    <div className="py-4 text-center text-xs text-surface-400">
                      {t('emailModal.noStudentsMatch') || 'No students match search'}
                    </div>
                  ) : (
                    filteredStudents.map((st) => {
                      const hasEmail = Boolean(st.email);
                      const isChecked = selectedIds.includes(st._id);

                      return (
                        <label
                          key={st._id}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                            !hasEmail
                              ? 'opacity-50 cursor-not-allowed bg-surface-100/40 dark:bg-surface-800/20'
                              : isChecked
                              ? 'bg-primary-500/10 text-primary-600 dark:text-primary-300 font-semibold cursor-pointer'
                              : 'hover:bg-surface-200/50 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              disabled={!hasEmail}
                              checked={isChecked && hasEmail}
                              onChange={() => hasEmail && toggleStudentSelection(st._id)}
                              className="rounded border-surface-300 text-primary-600 focus:ring-primary-500 disabled:opacity-40"
                            />
                            <span className="truncate" dir="auto">{st.fullName}</span>
                            <span className="font-mono text-xs text-surface-400">({st.studentId})</span>
                          </div>
                          <span
                            className={`text-xs truncate max-w-[170px] ${
                              hasEmail
                                ? 'text-surface-500 dark:text-surface-400 font-mono'
                                : 'text-rose-500 dark:text-rose-400 font-medium italic'
                            }`}
                          >
                            {st.email || (t('emailModal.noEmailSet') || 'No email set')}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
              {t('emailModal.subjectLine') || 'Subject Line *'}
            </label>
            <input
              type="text"
              required
              dir="auto"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('emailModal.subjectPlaceholder') || "e.g. Medresa Notice: Upcoming Exam Schedule & Materials"}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 focus:ring-2 focus:ring-primary-500 text-surface-900 dark:text-surface-100"
            />
          </div>

          {/* Message Content */}
          <div>
            <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
              {t('emailModal.announcementContent') || 'Announcement Content *'}
            </label>
            <textarea
              required
              rows={5}
              dir="auto"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('emailModal.announcementPlaceholder') || "Write announcement message for students here..."}
              className="w-full p-3.5 text-sm rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 focus:ring-2 focus:ring-primary-500 text-surface-900 dark:text-surface-100 resize-none"
            />
          </div>

          {/* File Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-surface-600 dark:text-surface-400 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-surface-400" />
                <span>{t('emailModal.attachFilesInfo') || 'Attach Files (PDF, Word, Images, Zip - Max 5 files, 25MB total)'}</span>
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline cursor-pointer"
              >
                {t('emailModal.addAttachments') || '+ Add Attachments'}
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              className="hidden"
            />

            {files.length > 0 && (
              <div className="space-y-1.5 p-2.5 rounded-xl bg-surface-100/60 dark:bg-surface-800/40 border border-surface-200 dark:border-surface-700">
                {files.map((file, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700/80 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary-500 shrink-0" />
                      <span className="truncate font-medium text-surface-800 dark:text-surface-200">
                        {file.name}
                      </span>
                      <span className="text-xs text-surface-400 shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="p-1 text-surface-400 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-200 dark:border-surface-700">
            <button
              type="button"
              onClick={handleResetAndClose}
              disabled={loading}
              className="px-4 py-2.5 text-xs font-semibold rounded-xl bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              {t('common.cancel') || 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={loading || activeRecipientsCount === 0}
              className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-primary-600 hover:bg-primary-700 text-white transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{loading ? (t('emailModal.sending') || 'Sending Email...') : (t('emailModal.sendCount', { count: activeRecipientsCount }) || `Send Email (${activeRecipientsCount})`)}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
