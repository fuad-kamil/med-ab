import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeDropdown from './ThemeDropdown';
import AiAssistantDrawer from './admin/AiAssistantDrawer';
import ConnectionStatus from './ConnectionStatus';
import {
  Sun,
  Moon,
  Monitor,
  Menu,
  User as UserIcon,
  LogOut,
  ChevronDown,
  Sparkles,
  ChevronRight,
  Settings as SettingsIcon,
  LayoutDashboard,
  Users,
  FileText,
  FolderOpen,
  BarChart3,
  BookOpen,
  Check,
} from 'lucide-react';

const ROUTE_ICONS = {
  '/admin': LayoutDashboard,
  '/admin/students': Users,
  '/admin/exams': FileText,
  '/admin/categories': FolderOpen,
  '/admin/results': BarChart3,
  '/admin/settings': SettingsIcon,
};

export default function TopBar({ onMenuClick, isMobileMenuOpen = false }) {
  const { t, i18n } = useTranslation();
  const { preference, resolved, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const userMenuRef = useRef(null);
  const userButtonRef = useRef(null);
  const aiButtonRef = useRef(null);
  const headerRef = useRef(null);

  // IntersectionObserver for top bar scroll shadow sentinel
  useEffect(() => {
    // Create an invisible sentinel element directly after topbar in DOM if needed
    const sentinel = document.createElement('div');
    sentinel.id = 'topbar-scroll-sentinel';
    sentinel.style.height = '1px';
    sentinel.style.marginTop = '-1px';
    sentinel.style.pointerEvents = 'none';
    sentinel.style.visibility = 'hidden';

    if (headerRef.current && headerRef.current.parentNode) {
      headerRef.current.parentNode.insertBefore(sentinel, headerRef.current.nextSibling);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      { threshold: [1.0], rootMargin: '0px 0px 0px 0px' }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      sentinel.remove();
    };
  }, []);

  // Map route to current section icon
  const SectionIcon = ROUTE_ICONS[location.pathname] || LayoutDashboard;

  // Compute Breadcrumbs
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const segments = path.split('/').filter(Boolean);

    const getSegmentLabel = (seg, idx, arr) => {
      if (seg === 'admin') return null;
      if (seg === 'students') return t('nav.students');
      if (seg === 'exams') return t('nav.exams');
      if (seg === 'categories') return t('nav.categories');
      if (seg === 'results') return t('nav.results');
      if (seg === 'settings') return t('nav.settings');
      if (seg === 'new') return t('common.create') || 'New';
      if (seg === 'edit') return t('common.edit') || 'Edit';
      if (arr[idx - 1] === 'exams') return t('exams.examDetails') || 'Exam Details';
      return seg;
    };

    const crumbs = [];
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      currentPath += `/${seg}`;
      const label = getSegmentLabel(seg, i, segments);
      if (label) {
        crumbs.push({ label, path: currentPath });
      }
    }

    if (crumbs.length === 0) {
      crumbs.push({ label: t('nav.dashboard'), path: '/admin' });
    }

    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();
  const currentTitle = breadcrumbs[breadcrumbs.length - 1]?.label || t('common.appName');

  // Update document.title on route change & language change
  useEffect(() => {
    document.title = `${currentTitle} · ${t('common.appName')}`;
  }, [currentTitle, t, location.pathname, i18n.language]);

  // Global Ctrl+K / Cmd+K shortcut for AI Assistant
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setAiOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle click outside & Escape key for User Menu
  useEffect(() => {
    if (!userMenuOpen) return;

    const handleClickOutside = (e) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target) &&
        userButtonRef.current &&
        !userButtonRef.current.contains(e.target)
      ) {
        setUserMenuOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setUserMenuOpen(false);
        userButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userMenuOpen]);

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate('/admin/login');
  };

  return (
    <header
      ref={headerRef}
      className={`sticky top-0 z-30 h-14 lg:h-16 bg-surface-900/92 backdrop-blur-md px-3 sm:px-4 lg:px-6 flex items-center justify-between transition-all duration-200 select-none ${
        isScrolled
          ? 'shadow-md shadow-black/20 border-b border-surface-300 dark:border-surface-700/60'
          : 'shadow-none border-b border-surface-200 dark:border-surface-800'
      }`}
    >
      {/* LEFT CLUSTER: Mobile Hamburger + Section Icon Tile + Page Title / Breadcrumbs */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 me-2">
        {/* Mobile Hamburger Drawer Trigger (<1024px) */}
        <button
          onClick={onMenuClick}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-sidebar-drawer"
          className="lg:hidden h-10 w-10 flex items-center justify-center rounded-xl text-surface-400 hover:text-surface-100 hover:bg-surface-800/60 border border-surface-200 dark:border-surface-800 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-[18px] h-[18px]" strokeWidth={1.75} />
        </button>

        {/* Section Icon Tile */}
        <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 flex items-center justify-center shrink-0">
          <SectionIcon className="w-4 h-4" strokeWidth={1.75} />
        </div>

        {/* Mobile Page Title (<1024px) */}
        <div className="lg:hidden min-w-[80px] flex-1 truncate">
          <h1 className="text-sm sm:text-base font-semibold text-surface-100 truncate leading-tight">
            {currentTitle}
          </h1>
        </div>

        {/* Desktop Breadcrumbs (>=1024px) */}
        <nav aria-label="Breadcrumb" className="hidden lg:block min-w-0 truncate">
          <ol className="flex items-center gap-1.5 text-sm text-surface-400">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <li key={crumb.path} className="flex items-center gap-1.5 truncate">
                  {idx > 0 && (
                    <ChevronRight
                      className="w-3.5 h-3.5 text-surface-500 shrink-0 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  )}
                  {isLast ? (
                    <span aria-current="page" className="font-bold text-surface-100 truncate">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      to={crumb.path}
                      className="hover:text-surface-200 hover:underline transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* RIGHT CLUSTER: Actions, AI Button, Language, Theme, User Menu */}
      <div className="flex items-center gap-2 xl:gap-3 shrink-0">
        {/* Render Cold-Start Server Status Pill */}
        <ConnectionStatus />

        {/* AI Assistant Button */}
        <button
          ref={aiButtonRef}
          onClick={() => setAiOpen(true)}
          aria-expanded={aiOpen}
          className="h-10 px-3 flex items-center gap-2 rounded-xl bg-surface-800/40 hover:bg-surface-800 border border-surface-200 dark:border-surface-800 text-surface-300 hover:text-surface-100 text-xs font-semibold transition-all cursor-pointer shadow-xs shrink-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          title={`AI Assistant (${navigator.platform?.includes('Mac') ? 'Cmd+K' : 'Ctrl+K'})`}
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-[18px] h-[18px] text-teal-400 shrink-0" strokeWidth={1.75} />
          <span className="hidden lg:inline">{t('common.aiAssistant') || 'AI Assistant'}</span>
        </button>

        {/* Desktop & Medium Language Dropdown (>=640px) */}
        <div className="hidden sm:block">
          <LanguageSwitcher variant="dropdown" />
        </div>

        {/* Theme Selector Dropdown (>=640px) */}
        <div className="hidden sm:block">
          <ThemeDropdown />
        </div>

        {/* User Chip Trigger */}
        <button
          ref={userButtonRef}
          onClick={() => setUserMenuOpen((prev) => !prev)}
          className="h-10 flex items-center gap-2 px-2 lg:px-2.5 rounded-xl bg-surface-800/40 hover:bg-surface-800 border border-surface-200 dark:border-surface-800 transition-all cursor-pointer shrink-0 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
          aria-expanded={userMenuOpen}
          aria-haspopup="true"
          aria-label={`User menu for ${user?.fullName || user?.username || 'Admin'}`}
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-primary-600 to-teal-400 ring-2 ring-primary-500/30 flex items-center justify-center font-bold text-white text-xs shadow-xs shrink-0">
            {(user?.fullName?.[0] || user?.username?.[0] || 'A').toUpperCase()}
          </div>
          <div className="hidden lg:flex flex-col text-start max-w-[140px] truncate leading-none">
            <span className="text-xs font-semibold text-surface-200 truncate">
              {user?.fullName || user?.username || 'Admin'}
            </span>
            <span className="text-[10px] text-surface-400 capitalize truncate mt-0.5">
              {user?.role || 'Admin'}
            </span>
          </div>
          <ChevronDown
            className={`w-3.5 h-3.5 text-surface-400 transition-transform duration-150 shrink-0 ${
              userMenuOpen ? 'rotate-180' : ''
            }`}
            strokeWidth={1.75}
          />
        </button>
      </div>

      {/* Portaled User Menu (Dropdown on >=640px / Bottom Sheet on <640px) */}
      {userMenuOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-xs transition-opacity"
              onClick={() => setUserMenuOpen(false)}
            />
            <div
              ref={userMenuRef}
              className="fixed z-[100] bottom-0 inset-x-0 sm:bottom-auto sm:top-14 sm:right-4 sm:left-auto w-full sm:w-72 rounded-t-2xl sm:rounded-2xl bg-surface-900 border border-surface-800 shadow-2xl p-4 sm:p-3 space-y-3 animate-slide-up sm:animate-scale-in text-surface-100 max-h-[90vh] overflow-y-auto"
            >
              {/* Profile Header Info Block */}
              <div className="flex items-center gap-3 pb-3 border-b border-surface-800">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-teal-400 ring-2 ring-primary-500/30 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
                  {(user?.fullName?.[0] || user?.username?.[0] || 'A').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <p className="text-sm font-bold text-surface-100 truncate">
                    {user?.fullName || user?.username || 'Admin'}
                  </p>
                  <p className="text-xs text-surface-400 capitalize truncate mt-0.5">
                    {user?.role || 'Administrator'}
                  </p>
                  {user?.email && (
                    <p className="text-[11px] text-surface-500 truncate mt-0.5" dir="ltr">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Navigation Items */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate('/admin/settings#profile');
                  }}
                  className="w-full flex items-center gap-2.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-surface-300 hover:text-surface-100 hover:bg-surface-800/70 transition-colors cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-surface-400 shrink-0" strokeWidth={1.75} />
                  <span>{t('nav.profile') || 'Profile'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate('/admin/settings');
                  }}
                  className="w-full flex items-center gap-2.5 min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-surface-300 hover:text-surface-100 hover:bg-surface-800/70 transition-colors cursor-pointer"
                >
                  <SettingsIcon className="w-4 h-4 text-surface-400 shrink-0" strokeWidth={1.75} />
                  <span>{t('nav.settings') || 'Settings'}</span>
                </button>
              </div>

              {/* Mobile-Only Controls (<640px): Language & Theme */}
              <div className="sm:hidden border-t border-surface-800 pt-3 space-y-3">
                {/* Language Radio Group */}
                <div>
                  <p className="text-xs font-medium text-surface-400 mb-2">{t('common.language')}</p>
                  <LanguageSwitcher
                    variant="menu-list"
                    onSelect={() => setUserMenuOpen(false)}
                  />
                </div>

                {/* Theme Radio Group */}
                <div className="border-t border-surface-800/60 pt-3">
                  <p className="text-xs font-medium text-surface-400 mb-2">{t('common.theme')}</p>
                  <div role="radiogroup" aria-label="Theme mode" className="grid grid-cols-3 gap-1.5">
                    {[
                      { key: 'light', label: t('nav.lightMode') || 'Light', icon: Sun },
                      { key: 'dark', label: t('nav.darkMode') || 'Dark', icon: Moon },
                      { key: 'system', label: t('nav.systemTheme') || 'System', icon: Monitor },
                    ].map((item) => {
                      const isActive = preference === item.key;
                      const IconComp = item.icon;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          role="radio"
                          aria-checked={isActive}
                          onClick={() => setTheme(item.key)}
                          className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                            isActive
                              ? 'bg-primary-500/15 border-primary-500/40 text-primary-400 font-semibold'
                              : 'bg-surface-800/40 border-surface-800 text-surface-400 hover:text-surface-200'
                          }`}
                        >
                          <IconComp className="w-4 h-4 mb-1" strokeWidth={1.75} />
                          <span className="text-[11px] truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Sign Out Button (Danger styling, after a divider) */}
              <div className="border-t border-surface-800 pt-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-400 shrink-0" strokeWidth={1.75} />
                  <span>{t('nav.signOut') || 'Sign Out'}</span>
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

      {/* AI Assistant Drawer */}
      <AiAssistantDrawer isOpen={aiOpen} onClose={() => setAiOpen(false)} triggerRef={aiButtonRef} />
    </header>
  );
}
