// HMR Refresh 2026-10-06
import { useState, useEffect, useRef, useId } from 'react';
import { useTranslation } from 'react-i18next';
import api, { extractError } from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { LANGUAGES, getLanguage } from '../../constants/languages';
import {
  getDisplayPreferences,
  setDisplayPreferences,
  formatDateTime,
  formatRelativeTime,
} from '../../utils/formatters';
import Button from '../../components/Button';
import Input from '../../components/Input';
import Toast from '../../components/Toast';
import Modal from '../../components/Modal';
import {
  User,
  Lock,
  Sun,
  Moon,
  Monitor,
  Eye,
  EyeOff,
  Globe,
  Mail,
  Database,
  ShieldCheck,
  Check,
  AlertTriangle,
  Send,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Info,
} from 'lucide-react';

const COMMON_PASSWORDS = [
  '12345678',
  'password',
  'admin1234',
  'medresa123',
  '123456789',
  'password123',
  'medresa2026',
];

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, setUser } = useAuth();
  const { preference, resolved, setTheme } = useTheme();

  const [activeSection, setActiveSection] = useState('profile');
  const [toast, setToast] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [saveSuccessBadge, setSaveSuccessBadge] = useState(null);

  // ------------------------------------------------------------------
  // 1. Profile State
  // ------------------------------------------------------------------
  const [profileInitial, setProfileInitial] = useState({ fullName: '', email: '' });
  const [profileForm, setProfileForm] = useState({ fullName: '', email: '', currentPassword: '' });
  const [profileLoading, setProfileLoading] = useState(false);

  // ------------------------------------------------------------------
  // 2. Security State
  // ------------------------------------------------------------------
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);

  // ------------------------------------------------------------------
  // 3. Display Preferences State
  // ------------------------------------------------------------------
  const [displayPrefs, setDisplayPrefsState] = useState(() => getDisplayPreferences());
  const [previewTime, setPreviewTime] = useState(() => new Date());

  // ------------------------------------------------------------------
  // 4. Email Settings State
  // ------------------------------------------------------------------
  const [emailSettingsInitial, setEmailSettingsInitial] = useState({
    senderName: 'Medresa Exam Portal',
    replyToEmail: '',
    resultEmailLanguage: 'auto',
    resultEmailIncludeAnswers: 'auto',
  });
  const [emailSettingsForm, setEmailSettingsForm] = useState({
    senderName: 'Medresa Exam Portal',
    replyToEmail: '',
    resultEmailLanguage: 'auto',
    resultEmailIncludeAnswers: 'auto',
  });
  const [emailSettingsLoading, setEmailSettingsLoading] = useState(false);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [emailConfiguredStatus, setEmailConfiguredStatus] = useState(true);

  // ------------------------------------------------------------------
  // 5. Data & Backup State
  // ------------------------------------------------------------------
  const [backupLoading, setBackupLoading] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [lastBackupAt, setLastBackupAt] = useState(null);

  // Section refs for scrollspy
  const sectionRefs = {
    profile: useRef(null),
    security: useRef(null),
    appearance: useRef(null),
    'language-region': useRef(null),
    email: useRef(null),
    backup: useRef(null),
  };

  const navChipBarRef = useRef(null);

  // Fetch initial profile & system settings
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setInitialLoading(true);
        const [profileRes, settingsRes] = await Promise.allSettled([
          api.get('/api/auth/admin/profile'),
          api.get('/api/admin/settings'),
        ]);

        if (mounted && profileRes.status === 'fulfilled' && profileRes.value.data?.user) {
          const u = profileRes.value.data.user;
          setProfileInitial({ fullName: u.fullName || '', email: u.email || '' });
          setProfileForm({ fullName: u.fullName || '', email: u.email || '', currentPassword: '' });
        } else if (mounted && user) {
          setProfileInitial({ fullName: user.fullName || '', email: user.email || '' });
          setProfileForm({ fullName: user.fullName || '', email: user.email || '', currentPassword: '' });
        }

        if (mounted && settingsRes.status === 'fulfilled' && settingsRes.value.data?.settings) {
          const s = settingsRes.value.data.settings;
          const initialEmailData = {
            senderName: s.senderName || 'Medresa Exam Portal',
            replyToEmail: s.replyToEmail || user?.email || '',
            resultEmailLanguage: s.resultEmailLanguage || 'auto',
            resultEmailIncludeAnswers: s.resultEmailIncludeAnswers || 'auto',
          };
          setEmailSettingsInitial(initialEmailData);
          setEmailSettingsForm(initialEmailData);
          setLastBackupAt(s.lastBackupAt || null);
          if (typeof s.isConfigured === 'boolean') {
            setEmailConfiguredStatus(s.isConfigured);
          }
        }
      } catch (err) {
        // Fallback
      } finally {
        if (mounted) setInitialLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  // Update live preview clock every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => setPreviewTime(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Scrollspy & hash sync
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && sectionRefs[hash]?.current) {
        setActiveSection(hash);
        sectionRefs[hash].current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          if (id) setActiveSection(id);
        }
      });
    }, observerOptions);

    Object.values(sectionRefs).forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      observer.disconnect();
    };
  }, []);

  // Auto scroll horizontal nav chip into view on mobile
  useEffect(() => {
    if (!navChipBarRef.current) return;
    const activeChip = navChipBarRef.current.querySelector(`[data-section="${activeSection}"]`);
    if (activeChip) {
      activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeSection]);

  // Unsaved changes guard for profile & email settings
  const isProfileDirty =
    profileForm.fullName.trim() !== profileInitial.fullName ||
    profileForm.email.trim() !== profileInitial.email;

  const isEmailSettingsDirty =
    emailSettingsForm.senderName.trim() !== emailSettingsInitial.senderName ||
    emailSettingsForm.replyToEmail.trim() !== emailSettingsInitial.replyToEmail ||
    emailSettingsForm.resultEmailLanguage !== emailSettingsInitial.resultEmailLanguage ||
    emailSettingsForm.resultEmailIncludeAnswers !== emailSettingsInitial.resultEmailIncludeAnswers;

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isProfileDirty || isEmailSettingsDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isProfileDirty, isEmailSettingsDirty]);

  // Handle section click
  const scrollToSection = (id) => {
    setActiveSection(id);
    window.history.pushState(null, '', `#${id}`);
    if (sectionRefs[id]?.current) {
      const topOffset = window.innerWidth >= 1024 ? 90 : 120;
      const elementPosition = sectionRefs[id].current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - topOffset, behavior: 'smooth' });
    }
  };

  // ------------------------------------------------------------------
  // Profile Actions
  // ------------------------------------------------------------------
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.fullName.trim()) return;

    const emailChanged = profileForm.email.trim() !== profileInitial.email;
    if (emailChanged && !profileForm.currentPassword) {
      setToast({ message: t('settings.fillCurrentPass') || 'Please enter current password to verify email change', type: 'error' });
      return;
    }

    setProfileLoading(true);
    try {
      const res = await api.put('/api/auth/admin/profile', {
        fullName: profileForm.fullName.trim(),
        email: profileForm.email.trim(),
        currentPassword: profileForm.currentPassword || undefined,
      });

      const updated = res.data.user;
      if (updated) {
        setProfileInitial({ fullName: updated.fullName, email: updated.email });
        setProfileForm((prev) => ({ ...prev, fullName: updated.fullName, email: updated.email, currentPassword: '' }));
        const currentLocal = JSON.parse(localStorage.getItem('user') || '{}');
        const nextLocal = { ...currentLocal, ...updated };
        localStorage.setItem('user', JSON.stringify(nextLocal));
        if (typeof setUser === 'function') setUser(nextLocal);
      }

      setToast({ message: t('settings.profileSection.saved') || 'Profile updated successfully!', type: 'success' });
    } catch (err) {
      const { message } = extractError(err, 'Failed to update profile');
      setToast({ message, type: 'error' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDiscardProfile = () => {
    setProfileForm({ fullName: profileInitial.fullName, email: profileInitial.email, currentPassword: '' });
  };

  // ------------------------------------------------------------------
  // Password Strength & Actions
  // ------------------------------------------------------------------
  const computePasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;
    if (COMMON_PASSWORDS.includes(pass.toLowerCase())) score = 0;

    if (score === 0 || pass.length < 8) {
      return { score: 1, label: t('settings.securitySection.weak') || 'Weak', color: 'bg-rose-500 text-rose-400' };
    }
    if (score === 2) {
      return { score: 2, label: t('settings.securitySection.fair') || 'Fair', color: 'bg-amber-500 text-amber-400' };
    }
    return { score: 3, label: t('settings.securitySection.strong') || 'Strong', color: 'bg-emerald-500 text-emerald-400' };
  };

  const strengthInfo = computePasswordStrength(passwordForm.newPassword);
  const isPassMinLength = passwordForm.newPassword.length >= 8;
  const isPassDifferent = passwordForm.newPassword && passwordForm.newPassword !== passwordForm.currentPassword;
  const isPassNotCommon = !COMMON_PASSWORDS.includes(passwordForm.newPassword.toLowerCase());
  const isPassMatch = passwordForm.confirmPassword && passwordForm.newPassword === passwordForm.confirmPassword;
  const isPasswordValid =
    passwordForm.currentPassword &&
    isPassMinLength &&
    isPassDifferent &&
    isPassNotCommon &&
    isPassMatch;

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!isPasswordValid) return;

    setPasswordLoading(true);
    try {
      await api.put('/api/auth/admin/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setToast({ message: t('settings.passwordChanged') || 'Password changed successfully!', type: 'success' });
    } catch (err) {
      const { message } = extractError(err, 'Failed to update password');
      setToast({ message, type: 'error' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSignOutAll = async () => {
    setSignOutLoading(true);
    try {
      await api.post('/api/auth/admin/signout-all');
      setSignOutModalOpen(false);
      setToast({
        message: t('settings.securitySection.signOutAllSuccess') || 'All other sessions have been signed out.',
        type: 'success',
      });
    } catch (err) {
      const { message } = extractError(err, 'Failed to sign out other sessions');
      setToast({ message, type: 'error' });
    } finally {
      setSignOutLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Display Preferences Actions
  // ------------------------------------------------------------------
  const updateDisplayPref = (key, val) => {
    const next = { ...displayPrefs, [key]: val };
    setDisplayPrefsState(next);
    setDisplayPreferences(next);
    triggerSaveBadge('appearance');
  };

  const triggerSaveBadge = (section) => {
    setSaveSuccessBadge(section);
    setTimeout(() => setSaveSuccessBadge(null), 2500);
  };

  // ------------------------------------------------------------------
  // Language Change Action
  // ------------------------------------------------------------------
  const handleLanguageChange = (code) => {
    const langObj = getLanguage(code);
    i18n.changeLanguage(code);
    localStorage.setItem('app_lang', code);
    document.documentElement.lang = code;
    document.documentElement.dir = langObj.dir;
    if (langObj.dir === 'rtl') {
      document.documentElement.classList.add('rtl-active');
    } else {
      document.documentElement.classList.remove('rtl-active');
    }
    triggerSaveBadge('language-region');
  };

  // ------------------------------------------------------------------
  // Email Settings Actions
  // ------------------------------------------------------------------
  const handleSaveEmailSettings = async (e) => {
    e.preventDefault();
    setEmailSettingsLoading(true);
    try {
      const res = await api.put('/api/admin/settings', {
        senderName: emailSettingsForm.senderName.trim(),
        replyToEmail: emailSettingsForm.replyToEmail.trim(),
        resultEmailLanguage: emailSettingsForm.resultEmailLanguage,
        resultEmailIncludeAnswers: emailSettingsForm.resultEmailIncludeAnswers,
      });

      if (res.data?.settings) {
        const s = res.data.settings;
        const updated = {
          senderName: s.senderName,
          replyToEmail: s.replyToEmail,
          resultEmailLanguage: s.resultEmailLanguage,
          resultEmailIncludeAnswers: s.resultEmailIncludeAnswers,
        };
        setEmailSettingsInitial(updated);
        setEmailSettingsForm(updated);
      }

      setToast({ message: t('common.saveChanges') + ' ✓', type: 'success' });
    } catch (err) {
      const { message } = extractError(err, 'Failed to save email settings');
      setToast({ message, type: 'error' });
    } finally {
      setEmailSettingsLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    setTestEmailLoading(true);
    try {
      const res = await api.post('/api/admin/settings/test-email');
      const targetEmail = res.data?.to || user?.email;
      setToast({
        message: t('settings.emailSection.testSuccess', { email: targetEmail }) || `Test email sent to ${targetEmail}!`,
        type: 'success',
      });
    } catch (err) {
      const { message } = extractError(err, 'Failed to send test email');
      setToast({ message, type: 'error' });
    } finally {
      setTestEmailLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Backup Actions
  // ------------------------------------------------------------------
  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.get('/api/admin/settings/backup/export', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const todayIso = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute('download', `medresa-backup-${todayIso}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      const now = new Date().toISOString();
      setLastBackupAt(now);
      setToast({ message: 'Backup JSON downloaded successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to download backup JSON', type: 'error' });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDownloadExcelResults = async () => {
    setExcelLoading(true);
    try {
      const res = await api.get('/api/results/export', { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const todayIso = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.setAttribute('download', `all-exam-results-${todayIso}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setToast({ message: 'Excel results report downloaded successfully!', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to download Excel results report', type: 'error' });
    } finally {
      setExcelLoading(false);
    }
  };

  const isBackupStale = () => {
    if (!lastBackupAt) return true;
    const diffDays = (Date.now() - new Date(lastBackupAt).getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 14;
  };

  const navSections = [
    { id: 'profile', label: t('settings.sections.profile') || 'Profile', icon: User },
    { id: 'security', label: t('settings.sections.security') || 'Security', icon: Lock },
    { id: 'appearance', label: t('settings.sections.appearance') || 'Appearance', icon: Sun },
    { id: 'language-region', label: t('settings.sections.languageRegion') || 'Language & Region', icon: Globe },
    { id: 'email', label: t('settings.sections.email') || 'Email', icon: Mail },
    { id: 'backup', label: t('settings.sections.backup') || 'Data & Backup', icon: Database },
  ];

  return (
    <div className="space-y-6 max-w-[1040px] mx-auto pb-16">
      {/* PAGE HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-surface-100 tracking-tight">
          {t('settings.title') || 'Ustaz Account & System Settings'}
        </h1>
        <p className="text-xs sm:text-sm text-surface-400 mt-1">
          {t('settings.subtitle') || 'Manage your account, appearance, and portal preferences'}
        </p>
      </div>

      {/* PROFILE SUMMARY HERO CARD */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-950/60 via-surface-900 to-surface-900 border border-primary-500/20 p-4 sm:p-6 shadow-md">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary-500/10 blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 relative z-10">
          {/* Avatar (72px) */}
          <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-tr from-primary-600 via-teal-500 to-emerald-400 ring-4 ring-primary-500/20 flex items-center justify-center font-bold text-2xl text-white shadow-md shrink-0">
            {(user?.fullName?.[0] || user?.username?.[0] || 'A').toUpperCase()}
          </div>

          <div className="flex-1 min-w-0 space-y-1.5 text-start">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-surface-100 truncate">
                {user?.fullName || user?.username || 'Ustaz Admin'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-500/15 text-primary-400 border border-primary-500/30 flex items-center gap-1 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{user?.role || t('settings.hero.adminRole') || 'Admin'}</span>
              </span>
            </div>
            {user?.email && (
              <p className="text-xs text-surface-400 truncate" dir="ltr">
                {user.email}
              </p>
            )}
            <p className="text-xs text-surface-400">
              {t('settings.hero.lastSignIn', {
                time: user?.lastSignInAt
                  ? formatRelativeTime(user.lastSignInAt)
                  : t('settings.hero.never') || 'Never',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* MOBILE STICKY HORIZONTAL SUB-NAVIGATION (<1024px) */}
      <div
        ref={navChipBarRef}
        className="lg:hidden sticky top-14 sm:top-16 z-20 bg-surface-950/90 backdrop-blur-md py-2 -mx-4 px-4 overflow-x-auto flex items-center gap-2 border-b border-surface-800 scrollbar-none snap-x"
      >
        {navSections.map((item) => {
          const isActive = activeSection === item.id;
          const IconComp = item.icon;
          return (
            <button
              key={item.id}
              data-section={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all snap-start cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-surface-900 border border-surface-800 text-surface-400 hover:text-surface-200'
              }`}
            >
              <IconComp className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* DESKTOP 2-COLUMN LAYOUT (Nav on Left, Content on Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* DESKTOP STICKY VERTICAL NAVIGATION (>=1024px, 220px / 3-cols) */}
        <aside className="hidden lg:block lg:col-span-3 sticky top-20 space-y-1">
          <nav aria-label="Settings sub navigation" className="space-y-1">
            {navSections.map((item) => {
              const isActive = activeSection === item.id;
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-start ${
                    isActive
                      ? 'bg-primary-600/15 text-primary-400 font-bold border-s-[3px] border-primary-500 shadow-xs'
                      : 'text-surface-400 hover:text-surface-200 hover:bg-surface-900/60 border-s-[3px] border-transparent'
                  }`}
                >
                  <IconComp className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* CONTENT COLUMN (Max-width 760px / 9-cols) */}
        <main className="lg:col-span-9 max-w-[760px] w-full space-y-8">
          {/* SECTION 1: PROFILE */}
          <section
            id="profile"
            ref={sectionRefs.profile}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-900/90 p-4 sm:p-6 space-y-5 shadow-xs"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-surface-800">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
                <User className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-start">
                <h3 className="text-base font-bold text-surface-100">
                  {t('settings.profileSection.title') || 'Profile Information'}
                </h3>
                <p className="text-xs text-surface-400">
                  {t('settings.profileSection.description') ||
                    'Update your display name and email address for system notifications.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <Input
                label={t('settings.profileSection.fullName') || 'Full Name'}
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                placeholder="e.g. Ustaz Admin"
                autoComplete="name"
                required
              />

              <Input
                label={t('settings.profileSection.email') || 'Email Address'}
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                placeholder="e.g. ustaz@medresa.edu"
                autoComplete="email"
                required
              />

              {/* Inline password field if email changed */}
              {profileForm.email.trim() !== profileInitial.email && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2 animate-fade-in">
                  <label className="block text-xs font-semibold text-amber-300">
                    {t('settings.profileSection.currentPasswordForEmail') ||
                      'Current Password (required when changing email)'}
                  </label>
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })}
                    placeholder="••••••••"
                    required
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-950 border border-surface-700 text-sm text-surface-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2 flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={!isProfileDirty || profileLoading || !profileForm.fullName.trim()}
                  loading={profileLoading}
                >
                  {t('settings.profileSection.saveChanges') || 'Save Changes'}
                </Button>

                {isProfileDirty && (
                  <button
                    type="button"
                    onClick={handleDiscardProfile}
                    className="text-xs font-medium text-surface-400 hover:text-surface-200 transition-colors cursor-pointer"
                  >
                    {t('settings.profileSection.discard') || 'Discard changes'}
                  </button>
                )}
              </div>
            </form>
          </section>

          {/* SECTION 2: SECURITY */}
          <section
            id="security"
            ref={sectionRefs.security}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-900/90 p-4 sm:p-6 space-y-6 shadow-xs"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-surface-800">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-start">
                <h3 className="text-base font-bold text-surface-100">
                  {t('settings.securitySection.title') || 'Password'}
                </h3>
                <p className="text-xs text-surface-400">
                  {t('settings.securitySection.description') ||
                    'Use a strong password you do not use anywhere else.'}
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* Current Password */}
              <div className="space-y-1 text-start">
                <label className="block text-xs font-medium text-surface-300">
                  {t('settings.securitySection.currentPassword') || 'Current Password'}
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    onKeyDown={(e) => setCapsLockActive(e.getModifierState('CapsLock'))}
                    placeholder="Enter current password"
                    autoComplete="current-password"
                    required
                    className="w-full h-11 px-3.5 pe-10 text-base sm:text-sm rounded-xl bg-surface-950 border border-surface-800 text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    aria-pressed={showCurrentPass}
                    aria-label={showCurrentPass ? 'Hide password' : 'Show password'}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 p-1 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1 text-start">
                <label className="block text-xs font-medium text-surface-300">
                  {t('settings.securitySection.newPassword') || 'New Password'}
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    onKeyDown={(e) => setCapsLockActive(e.getModifierState('CapsLock'))}
                    placeholder="Enter new password (min 8 characters)"
                    autoComplete="new-password"
                    required
                    className="w-full h-11 px-3.5 pe-10 text-base sm:text-sm rounded-xl bg-surface-950 border border-surface-800 text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    aria-pressed={showNewPass}
                    aria-label={showNewPass ? 'Hide password' : 'Show password'}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 p-1 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {passwordForm.newPassword && (
                  <div className="pt-2 space-y-1.5 animate-fade-in" aria-live="polite">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-surface-400">
                        {t('settings.securitySection.strength', { level: strengthInfo.label })}
                      </span>
                      <span className={`font-semibold ${strengthInfo.color}`}>{strengthInfo.label}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-surface-800 overflow-hidden flex">
                      <div
                        className={`h-full transition-all duration-300 ${
                          strengthInfo.score >= 1 ? 'w-1/3 bg-rose-500' : 'w-0'
                        }`}
                      />
                      <div
                        className={`h-full transition-all duration-300 ${
                          strengthInfo.score >= 2 ? 'w-1/3 bg-amber-500' : 'w-0'
                        }`}
                      />
                      <div
                        className={`h-full transition-all duration-300 ${
                          strengthInfo.score >= 3 ? 'w-1/3 bg-emerald-500' : 'w-0'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3 rounded-xl bg-surface-950/60 border border-surface-800 space-y-1.5 text-xs text-surface-400 text-start">
                <p className="font-semibold text-surface-300 mb-1">
                  {t('settings.securitySection.requirements') || 'Password Requirements:'}
                </p>
                <div className="flex items-center gap-2">
                  <Check
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isPassMinLength ? 'text-emerald-400' : 'text-surface-600'
                    }`}
                  />
                  <span className={isPassMinLength ? 'text-surface-200' : ''}>
                    {t('settings.securitySection.reqMinLength') || 'At least 8 characters'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isPassDifferent ? 'text-emerald-400' : 'text-surface-600'
                    }`}
                  />
                  <span className={isPassDifferent ? 'text-surface-200' : ''}>
                    {t('settings.securitySection.reqDifferent') || 'Different from current password'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Check
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isPassNotCommon ? 'text-emerald-400' : 'text-surface-600'
                    }`}
                  />
                  <span className={isPassNotCommon ? 'text-surface-200' : ''}>
                    {t('settings.securitySection.reqNotCommon') || 'Not a common password'}
                  </span>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1 text-start">
                <label className="block text-xs font-medium text-surface-300">
                  {t('settings.securitySection.confirmPassword') || 'Confirm New Password'}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    onKeyDown={(e) => setCapsLockActive(e.getModifierState('CapsLock'))}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    required
                    className="w-full h-11 px-3.5 pe-10 text-base sm:text-sm rounded-xl bg-surface-950 border border-surface-800 text-surface-100 placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    aria-pressed={showConfirmPass}
                    aria-label={showConfirmPass ? 'Hide password' : 'Show password'}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-200 p-1 cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {passwordForm.confirmPassword && (
                  <p
                    className={`text-xs font-medium mt-1 ${
                      isPassMatch ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isPassMatch
                      ? t('settings.securitySection.match') || '✓ Passwords match'
                      : t('settings.securitySection.mismatch') || '✕ Passwords do not match'}
                  </p>
                )}
              </div>

              {/* Caps Lock Warning */}
              {capsLockActive && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {t('settings.securitySection.capsLockOn') || 'Caps Lock is ON'}
                  </span>
                </div>
              )}

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={!isPasswordValid || passwordLoading}
                  loading={passwordLoading}
                >
                  {t('settings.securitySection.updatePassword') || 'Update Password'}
                </Button>
              </div>
            </form>

            {/* Row: Sign Out of All Devices */}
            <div className="pt-4 border-t border-surface-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start">
              <div>
                <h4 className="text-xs font-bold text-surface-200">
                  {t('settings.securitySection.signOutAll') || 'Sign Out of All Devices'}
                </h4>
                <p className="text-xs text-surface-400">
                  {t('settings.securitySection.signOutAllDesc') ||
                    'Revoke all other active admin login sessions.'}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSignOutModalOpen(true)}
                className="shrink-0 text-rose-400 hover:text-rose-300 border-rose-500/30 hover:bg-rose-500/10"
              >
                {t('settings.securitySection.signOutAll') || 'Sign Out of All Devices'}
              </Button>
            </div>
          </section>

          {/* SECTION 3: APPEARANCE */}
          <section
            id="appearance"
            ref={sectionRefs.appearance}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-900/90 p-4 sm:p-6 space-y-6 shadow-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
                  <Sun className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div className="text-start">
                  <h3 className="text-base font-bold text-surface-100">
                    {t('settings.appearanceSection.title') || 'Theme Mode'}
                  </h3>
                  <p className="text-xs text-surface-400">
                    {t('settings.appearanceSection.description') ||
                      'Choose how the portal looks for you. Changes apply immediately.'}
                  </p>
                </div>
              </div>

              {saveSuccessBadge === 'appearance' && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('settings.appearanceSection.savedBadge') || 'Saved'}</span>
                </span>
              )}
            </div>

            {/* Selectable Theme Cards Radiogroup */}
            <div role="radiogroup" aria-label="Theme selection" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  key: 'light',
                  label: t('settings.appearanceSection.light') || 'Light',
                  icon: Sun,
                  bgClass: 'bg-stone-100 text-stone-900',
                  mockBg: 'bg-white border-stone-200',
                  sidebarBg: 'bg-stone-200',
                },
                {
                  key: 'dark',
                  label: t('settings.appearanceSection.dark') || 'Dark',
                  icon: Moon,
                  bgClass: 'bg-surface-950 text-surface-100',
                  mockBg: 'bg-surface-900 border-surface-800',
                  sidebarBg: 'bg-surface-800',
                },
                {
                  key: 'system',
                  label: t('settings.appearanceSection.system') || 'System',
                  icon: Monitor,
                  bgClass: 'bg-gradient-to-r from-stone-100 to-surface-950',
                  mockBg: 'bg-surface-900 border-surface-800',
                  sidebarBg: 'bg-surface-800',
                },
              ].map((themeOpt) => {
                const isActive = preference === themeOpt.key;
                const IconComp = themeOpt.icon;
                return (
                  <button
                    key={themeOpt.key}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => {
                      setTheme(themeOpt.key);
                      triggerSaveBadge('appearance');
                    }}
                    className={`relative flex flex-col p-4 rounded-2xl border transition-all cursor-pointer text-start ${
                      isActive
                        ? 'border-primary-500 ring-2 ring-primary-500/30 bg-primary-500/5'
                        : 'border-surface-800 bg-surface-950/60 hover:bg-surface-800/50'
                    }`}
                  >
                    {/* Mini CSS UI Mock */}
                    <div
                      className={`w-full h-20 rounded-xl ${themeOpt.mockBg} border p-2 mb-3 flex gap-2 overflow-hidden shadow-xs`}
                    >
                      <div className={`w-1/4 h-full rounded-lg ${themeOpt.sidebarBg}`} />
                      <div className="flex-1 space-y-1.5">
                        <div className="w-3/4 h-2.5 rounded bg-primary-500/30" />
                        <div className="w-1/2 h-2 rounded bg-surface-600/30" />
                        <div className="w-full h-8 rounded-lg bg-surface-700/20 border border-surface-700/30" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-2">
                        <IconComp className="w-4 h-4 text-surface-300 shrink-0" strokeWidth={1.75} />
                        <span className="text-xs font-bold text-surface-100">{themeOpt.label}</span>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-primary-400 shrink-0" strokeWidth={2} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* SECTION 4: LANGUAGE & REGION */}
          <section
            id="language-region"
            ref={sectionRefs['language-region']}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-900/90 p-4 sm:p-6 space-y-6 shadow-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div className="text-start">
                  <h3 className="text-base font-bold text-surface-100">
                    {t('settings.languageRegionSection.title') || 'Language & Region'}
                  </h3>
                  <p className="text-xs text-surface-400">
                    {t('settings.languageRegionSection.description') ||
                      'Set your preferred interface language and formatting display options.'}
                  </p>
                </div>
              </div>

              {saveSuccessBadge === 'language-region' && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 animate-fade-in">
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('settings.appearanceSection.savedBadge') || 'Saved'}</span>
                </span>
              )}
            </div>

            {/* Interface Language Radiogroup */}
            <div className="space-y-3 text-start">
              <label className="text-sm font-medium text-surface-300">
                {t('settings.languageRegionSection.interfaceLanguage') || 'Interface Language'}
              </label>

              <div role="radiogroup" aria-label="Interface Language" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {LANGUAGES.map((lang) => {
                  const isActive = (i18n.language || 'en').slice(0, 2) === lang.code;
                  const glyph = lang.code === 'en' ? 'Aa' : lang.code === 'am' ? 'አ' : 'ع';
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer text-start ${
                        isActive
                          ? 'border-primary-500 ring-2 ring-primary-500/30 bg-primary-500/10'
                          : 'border-surface-800 bg-surface-950/60 hover:bg-surface-800/50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-surface-800 flex items-center justify-center font-bold text-base text-primary-400 shrink-0">
                        {glyph}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span lang={lang.code} className="text-xs font-bold text-surface-100 truncate">
                            {lang.nativeName}
                          </span>
                          {lang.isRtl && (
                            <span className="px-1 py-0.5 rounded text-xs font-semibold bg-surface-800 text-surface-400 border border-surface-700">
                              RTL
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-surface-400 block truncate">{lang.label}</span>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-primary-400 shrink-0" strokeWidth={2} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display Preferences */}
            <div className="pt-4 border-t border-surface-800 space-y-4 text-start">
              <label className="text-sm font-medium text-surface-300 block">
                {t('settings.languageRegionSection.displayPreferences') || 'Display Preferences'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Calendar Format */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-surface-400">
                    {t('settings.languageRegionSection.calendarFormat') || 'Calendar Format'}
                  </label>
                  <select
                    value={displayPrefs.calendar}
                    onChange={(e) => updateDisplayPref('calendar', e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-surface-950 border border-surface-800 text-xs font-semibold text-surface-100 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
                  >
                    <option value="gregorian">
                      {t('settings.languageRegionSection.gregorian') || 'Gregorian (Default)'}
                    </option>
                    <option value="hijri">
                      {t('settings.languageRegionSection.hijri') || 'Hijri (Umm al-Qura)'}
                    </option>
                  </select>
                </div>

                {/* Numerals */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-surface-400">
                    {t('settings.languageRegionSection.numerals') || 'Numerals'}
                  </label>
                  <select
                    value={displayPrefs.numerals}
                    onChange={(e) => updateDisplayPref('numerals', e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-surface-950 border border-surface-800 text-xs font-semibold text-surface-100 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
                  >
                    <option value="western">
                      {t('settings.languageRegionSection.westernNumerals') || 'Western (0-9)'}
                    </option>
                    <option value="indic">
                      {t('settings.languageRegionSection.indicNumerals') || 'Arabic-Indic (٠-٩)'}
                    </option>
                  </select>
                </div>

                {/* Time Format */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-surface-400">
                    {t('settings.languageRegionSection.timeFormat') || 'Time Format'}
                  </label>
                  <select
                    value={displayPrefs.timeFormat}
                    onChange={(e) => updateDisplayPref('timeFormat', e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-surface-950 border border-surface-800 text-xs font-semibold text-surface-100 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
                  >
                    <option value="12h">
                      {t('settings.languageRegionSection.time12h') || '12-hour (1:30 PM)'}
                    </option>
                    <option value="24h">
                      {t('settings.languageRegionSection.time24h') || '24-hour (13:30)'}
                    </option>
                  </select>
                </div>
              </div>

              {/* Live Format Preview Bar */}
              <div className="p-3 rounded-xl bg-surface-950/80 border border-surface-800 flex items-center justify-between text-xs text-surface-300">
                <span className="font-semibold text-surface-400">
                  {t('settings.languageRegionSection.livePreview') || 'Live Preview'}:
                </span>
                <span className="font-mono text-primary-400 font-bold">
                  Today: {formatDateTime(previewTime)}
                </span>
              </div>
            </div>
          </section>

          {/* SECTION 5: EMAIL */}
          <section
            id="email"
            ref={sectionRefs.email}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-900/90 p-4 sm:p-6 space-y-6 shadow-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div className="text-start">
                  <h3 className="text-base font-bold text-surface-100">
                    {t('settings.emailSection.title') || 'Email & Delivery Settings'}
                  </h3>
                  <p className="text-xs text-surface-400">
                    {t('settings.emailSection.description') ||
                      'Configure default sender profile and student result email defaults.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Email Status Indicator */}
            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
                emailConfiguredStatus
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}
            >
              <div className="flex items-center gap-2 text-start">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  {emailConfiguredStatus
                    ? t('settings.emailSection.statusConfigured') || 'SMTP Email is configured & active'
                    : t('settings.emailSection.statusNotConfigured') ||
                      'SMTP Email is not configured (credentials missing)'}
                </span>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleSendTestEmail}
                loading={testEmailLoading}
                className="shrink-0"
              >
                <Send className="w-3.5 h-3.5 me-1.5" />
                <span>{t('settings.emailSection.sendTestEmail') || 'Send Test Email'}</span>
              </Button>
            </div>

            <form onSubmit={handleSaveEmailSettings} className="space-y-4 text-start">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('settings.emailSection.senderName') || 'Sender Name'}
                  value={emailSettingsForm.senderName}
                  onChange={(e) => setEmailSettingsForm({ ...emailSettingsForm, senderName: e.target.value })}
                  placeholder="Medresa Exam Portal"
                  required
                />

                <Input
                  label={t('settings.emailSection.replyTo') || 'Reply-To Email'}
                  type="email"
                  value={emailSettingsForm.replyToEmail}
                  onChange={(e) => setEmailSettingsForm({ ...emailSettingsForm, replyToEmail: e.target.value })}
                  placeholder="ustaz@medresa.edu"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-surface-300">
                    {t('settings.emailSection.resultEmailLang') || 'Default Result Email Language'}
                  </label>
                  <select
                    value={emailSettingsForm.resultEmailLanguage}
                    onChange={(e) => setEmailSettingsForm({ ...emailSettingsForm, resultEmailLanguage: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl bg-surface-950 border border-surface-800 text-xs font-semibold text-surface-100 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
                  >
                    <option value="auto">
                      {t('settings.emailSection.followInterface') || 'Follow Interface Language'}
                    </option>
                    <option value="en">English</option>
                    <option value="am">አማርኛ</option>
                    <option value="ar">العربية</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-surface-300">
                    {t('settings.emailSection.includeAnswers') || 'Include Answer Review'}
                  </label>
                  <select
                    value={emailSettingsForm.resultEmailIncludeAnswers}
                    onChange={(e) =>
                      setEmailSettingsForm({ ...emailSettingsForm, resultEmailIncludeAnswers: e.target.value })
                    }
                    className="w-full h-11 px-3 rounded-xl bg-surface-950 border border-surface-800 text-xs font-semibold text-surface-100 focus:ring-2 focus:ring-primary-500 focus:outline-none cursor-pointer"
                  >
                    <option value="auto">
                      {t('settings.emailSection.followExam') || "Follow Each Exam's Setting"}
                    </option>
                    <option value="always">
                      {t('settings.emailSection.always') || 'Always Include'}
                    </option>
                    <option value="never">
                      {t('settings.emailSection.never') || 'Never Include'}
                    </option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" disabled={!isEmailSettingsDirty || emailSettingsLoading} loading={emailSettingsLoading}>
                  {t('settings.emailSection.saveBtn') || 'Save Email Settings'}
                </Button>
              </div>
            </form>
          </section>

          {/* SECTION 6: DATA & BACKUP */}
          <section
            id="backup"
            ref={sectionRefs.backup}
            className="rounded-2xl border border-surface-200 dark:border-surface-800 bg-surface-900/90 p-4 sm:p-6 space-y-6 shadow-xs"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-surface-800">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 text-start">
                <h3 className="text-base font-bold text-surface-100">
                  {t('settings.backupSection.title') || 'Data & Backup'}
                </h3>
                <p className="text-xs text-surface-400">
                  {t('settings.backupSection.description') ||
                    'Export full system JSON snapshots or Excel reports.'}
                </p>
              </div>
            </div>

            {/* Amber warning hint if backup > 14 days ago */}
            {isBackupStale() && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-2.5 text-xs font-semibold text-start animate-fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {t('settings.backupSection.backupWarningNotice') ||
                    'Your last backup was more than 14 days ago. Download a backup before your next exam.'}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
              <div className="space-y-1 text-start">
                <p className="text-xs font-bold text-surface-200">
                  {t('settings.backupSection.lastBackupLabel', {
                    date: lastBackupAt
                      ? formatDateTime(lastBackupAt)
                      : t('settings.backupSection.neverBackup') || 'Never',
                  })}
                </p>
                <p className="text-xs text-surface-500">
                  Includes students, categories, exams, results & settings (excludes passwords/tokens).
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  onClick={handleDownloadBackup}
                  loading={backupLoading}
                  className="bg-primary-600 hover:bg-primary-500"
                >
                  <Download className="w-4 h-4 me-1.5" />
                  <span>{t('settings.backupSection.downloadBackup') || 'Download JSON Backup'}</span>
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleDownloadExcelResults}
                  loading={excelLoading}
                >
                  <FileSpreadsheet className="w-4 h-4 me-1.5" />
                  <span>{t('settings.backupSection.downloadExcelResults') || 'Download Results (Excel)'}</span>
                </Button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* SIGN OUT ALL DEVICES CONFIRMATION MODAL */}
      {signOutModalOpen && (
        <Modal
          isOpen={signOutModalOpen}
          onClose={() => setSignOutModalOpen(false)}
          title={t('settings.securitySection.signOutAll') || 'Sign Out of All Devices'}
        >
          <div className="space-y-4 text-start">
            <p className="text-xs text-surface-300">
              {t('settings.securitySection.signOutAllConfirm') ||
                'Are you sure you want to sign out all other devices? All existing active sessions on other browsers will be invalidated.'}
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setSignOutModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleSignOutAll}
                loading={signOutLoading}
              >
                {t('settings.securitySection.signOutAll') || 'Sign Out of All Devices'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
