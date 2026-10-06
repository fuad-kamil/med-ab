import { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopBar from '../components/TopBar';
import {
  LayoutDashboard,
  Users,
  FileText,
  FolderOpen,
  BarChart3,
  BookOpen,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export default function AdminLayout() {
  const { t } = useTranslation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const navItems = [
    { to: '/admin', icon: LayoutDashboard, key: 'nav.dashboard', end: true },
    { to: '/admin/students', icon: Users, key: 'nav.students' },
    { to: '/admin/exams', icon: FileText, key: 'nav.exams' },
    { to: '/admin/categories', icon: FolderOpen, key: 'nav.categories' },
    { to: '/admin/results', icon: BarChart3, key: 'nav.results' },
    { to: '/admin/settings', icon: Settings, key: 'nav.settings' },
  ];

  return (
    <div className="flex min-h-screen bg-surface-950 text-surface-100 font-sans antialiased">
      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky top-0 left-0 z-50 lg:z-30
          h-screen bg-surface-900/95 backdrop-blur-xl
          border-r border-surface-800
          flex flex-col transition-all duration-200 ease-in-out
          ${collapsed ? 'lg:w-[72px]' : 'lg:w-64'}
          ${mobileDrawerOpen ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Sidebar Logo Header - Standardized 64px (h-16) */}
        <div className="h-16 px-4 border-b border-surface-800 flex items-center shrink-0">
          <div className="flex items-center gap-3 min-w-0 w-full overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-primary-600/15 border border-primary-500/20 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary-400" strokeWidth={1.75} />
            </div>
            {(!collapsed || mobileDrawerOpen) && (
              <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                <span className="text-base font-bold text-surface-100 truncate">Medresa</span>
                <span className="text-xs text-surface-500 font-medium truncate">Exam Portal</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileDrawerOpen(false)}
              title={collapsed ? t(item.key) : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  isActive
                    ? 'bg-primary-600/15 text-primary-400 border-l-[3px] border-primary-500 font-semibold shadow-xs'
                    : 'text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 border-l-[3px] border-transparent'
                } ${collapsed ? 'lg:justify-center' : ''}`
              }
              aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
            >
              <item.icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
              {(!collapsed || mobileDrawerOpen) && (
                <span className="truncate">{t(item.key)}</span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Bottom: Collapse Control (Desktop Only) */}
        <div className="p-3 border-t border-surface-800 hidden lg:block shrink-0">
          <button
            onClick={toggleCollapsed}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-surface-400 hover:text-surface-200 hover:bg-surface-800/60 transition-colors cursor-pointer ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? (t('admin.expandSidebar') || 'Expand sidebar') : (t('admin.collapseSidebar') || 'Collapse sidebar')}
            aria-label="Toggle sidebar collapse"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-5 h-5 shrink-0" strokeWidth={1.75} />
            ) : (
              <>
                <PanelLeftClose className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{t('admin.collapseSidebar') || 'Collapse sidebar'}</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <TopBar onMenuClick={() => setMobileDrawerOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 w-full max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
