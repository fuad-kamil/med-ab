import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../hooks/useDashboard';
import { ErrorState, Badge } from '../../components/Common';
import Toast from '../../components/Toast';
import { formatDate, formatRelativeTime, formatDurationMinutes } from '../../utils/formatters';
import {
  Users,
  FileText,
  Radio,
  Award,
  Plus,
  BarChart3,
  ExternalLink,
  ChevronRight,
  FolderOpen,
  UserPlus,
  RefreshCw,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-64 bg-surface-800 rounded-lg" />
        <div className="h-4 w-48 bg-surface-800/60 rounded-md" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-xl bg-surface-800" />
              <div className="h-3 w-16 bg-surface-800/50 rounded" />
            </div>
            <div className="h-8 w-20 bg-surface-800 rounded-lg" />
            <div className="h-3 w-28 bg-surface-800/40 rounded" />
          </div>
        ))}
      </div>

      {/* Sections skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6 h-64 bg-surface-900/40 border border-surface-800 rounded-xl" />
        <div className="glass-card p-6 h-64 bg-surface-900/40 border border-surface-800 rounded-xl" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useDashboard();
  const [toast, setToast] = useState(null);

  const copyExamLink = (token) => {
    const url = `${window.location.origin}/exam/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setToast({ message: t('common.copied'), type: 'info' });
    });
  };

  if (loading && !data) return <DashboardSkeleton />;
  if (error && !data) return <ErrorState message={error.message} code={error.code} onRetry={refetch} />;

  const { overview, liveExams, recentSubmissions, categoriesOverview } = data || {
    overview: { totalStudents: 0, activeStudents: 0, totalExams: 0, draftExams: 0, openExamsCount: 0, submissionsThisWeek: 0 },
    liveExams: [],
    recentSubmissions: [],
    categoriesOverview: [],
  };

  const formattedDate = formatDate(new Date(), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-100">
            {t('dashboard.welcomeBack', { name: user?.fullName || user?.username || 'Admin' })}
          </h1>
          <p className="text-sm text-surface-400 mt-1">{formattedDate}</p>
        </div>

        {/* Quick Action Toolbar */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate('/admin/students')}
            className="min-h-[44px] px-3 rounded-xl bg-surface-800/80 hover:bg-surface-800 border border-surface-700/60 text-xs font-semibold text-surface-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-primary-400" strokeWidth={1.75} />
            <span>{t('dashboard.addStudent')}</span>
          </button>
          <button
            onClick={() => navigate('/admin/exams/new')}
            className="min-h-[44px] px-3 rounded-xl bg-primary-600 hover:bg-primary-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>{t('dashboard.createExam')}</span>
          </button>
          <button
            onClick={() => navigate('/admin/results')}
            className="min-h-[44px] col-span-2 sm:col-span-1 px-3 rounded-xl bg-surface-800/80 hover:bg-surface-800 border border-surface-700/60 text-xs font-semibold text-surface-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <BarChart3 className="w-4 h-4 text-info-400" strokeWidth={1.75} />
            <span>{t('dashboard.viewResults')}</span>
          </button>
        </div>
      </div>

      {/* 4 Interactive Stat Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Stat Card 1: Students */}
        <Link
          to="/admin/students"
          className="glass-card p-5 rounded-xl hover:border-primary-500/40 transition-all duration-200 group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600/15 border border-primary-500/20 flex items-center justify-center text-primary-400 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <span className="text-xs font-medium text-surface-400 group-hover:text-surface-200 flex items-center gap-1 transition-colors">
              {t('nav.students')} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-semibold text-surface-100 tracking-tight tabular-nums">
              {overview.totalStudents}
            </div>
            <p className="text-xs text-surface-400 mt-1 font-medium">
              {t('dashboard.totalStudentsSub', { count: overview.activeStudents })}
            </p>
          </div>
        </Link>

        {/* Stat Card 2: Exams */}
        <Link
          to="/admin/exams"
          className="glass-card p-5 rounded-xl hover:border-warning-500/40 transition-all duration-200 group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-warning-500/15 border border-warning-500/20 flex items-center justify-center text-warning-400 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <span className="text-xs font-medium text-surface-400 group-hover:text-surface-200 flex items-center gap-1 transition-colors">
              {t('nav.exams')} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-semibold text-surface-100 tracking-tight tabular-nums">
              {overview.totalExams}
            </div>
            <p className="text-xs text-surface-400 mt-1 font-medium">
              {t('dashboard.totalExamsSub', { count: overview.draftExams })}
            </p>
          </div>
        </Link>

        {/* Stat Card 3: Open Exams */}
        <Link
          to="/admin/exams"
          className={`glass-card p-5 rounded-xl transition-all duration-200 group flex flex-col justify-between ${
            overview.openExamsCount > 0 ? 'border-success-500/40 bg-success-500/5' : 'hover:border-surface-700'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                overview.openExamsCount > 0
                  ? 'bg-success-500/20 border border-success-500/30 text-success-400'
                  : 'bg-surface-800 text-surface-400'
              }`}
            >
              <Radio className="w-5 h-5 animate-pulse" strokeWidth={1.75} />
            </div>
            <span className="text-xs font-medium text-surface-400 group-hover:text-surface-200 flex items-center gap-1 transition-colors">
              {t('dashboard.openExams')} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-semibold text-surface-100 tracking-tight tabular-nums">
              {overview.openExamsCount}
            </div>
            <p className="text-xs text-surface-400 mt-1 font-medium">{t('common.open')}</p>
          </div>
        </Link>

        {/* Stat Card 4: Submissions This Week */}
        <Link
          to="/admin/results"
          className="glass-card p-5 rounded-xl hover:border-info-500/40 transition-all duration-200 group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-info-500/15 border border-info-500/20 flex items-center justify-center text-info-400 group-hover:scale-105 transition-transform">
              <Award className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <span className="text-xs font-medium text-surface-400 group-hover:text-surface-200 flex items-center gap-1 transition-colors">
              {t('nav.results')} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <div className="text-3xl font-semibold text-surface-100 tracking-tight tabular-nums">
              {overview.submissionsThisWeek}
            </div>
            <p className="text-xs text-surface-400 mt-1 font-medium">
              {t('dashboard.thisWeek', { count: overview.submissionsThisWeek })}
            </p>
          </div>
        </Link>
      </div>

      {/* Main Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Live Now & Recent Submissions */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Now Section */}
          <div className="glass-card p-5 sm:p-6 rounded-xl border border-surface-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success-500" />
                </span>
                <h2 className="text-base font-bold text-surface-100">{t('dashboard.liveNow')}</h2>
              </div>
              <Link
                to="/admin/exams"
                className="text-xs text-primary-400 hover:underline flex items-center gap-1 font-medium"
              >
                {t('exams.title')} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {liveExams.length === 0 ? (
              <div className="py-8 text-center rounded-xl bg-surface-900/40 border border-surface-800/60 p-4">
                <Radio className="w-8 h-8 text-surface-500 mx-auto mb-2" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-surface-200">{t('dashboard.noLiveExamsTitle')}</p>
                <p className="text-xs text-surface-400 mt-1 max-w-sm mx-auto">
                  {t('dashboard.noLiveExamsMessage')}
                </p>
                <button
                  onClick={() => navigate('/admin/exams/new')}
                  className="mt-4 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  {t('exams.createExam')}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {liveExams.map((exam) => {
                  const percent =
                    exam.eligible > 0 ? Math.min(100, Math.round((exam.submitted / exam.eligible) * 100)) : 0;

                  return (
                    <div
                      key={exam._id}
                      className="p-4 rounded-xl bg-surface-900/60 border border-surface-800 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-surface-100">{exam.title}</h3>
                            <Badge variant="primary">{exam.categoryName}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-surface-400 mt-1">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-primary-400" />
                              {formatDurationMinutes(exam.durationMinutes)}
                            </span>
                            <span>•</span>
                            <span>
                              {exam.submitted} submitted / {exam.started} started / {exam.eligible} eligible
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyExamLink(exam.accessToken)}
                            className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Copy exam shareable link"
                          >
                            <Copy className="w-3.5 h-3.5 text-primary-400" />
                            Link
                          </button>
                          <button
                            onClick={() => navigate(`/admin/results?examId=${exam._id}`)}
                            className="px-3 py-1.5 rounded-lg bg-primary-600/20 hover:bg-primary-600/30 text-primary-400 border border-primary-600/30 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t('dashboard.monitor')}
                          </button>
                        </div>
                      </div>

                      {/* Candidate Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs text-surface-400 mb-1 font-medium">
                          <span>{t('dashboard.participationRate') || 'Participation Rate'}</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-500 to-success-500 transition-all duration-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Submissions Section */}
          <div className="glass-card p-5 sm:p-6 rounded-xl border border-surface-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-surface-100">{t('dashboard.recentSubmissions')}</h2>
              <Link
                to="/admin/results"
                className="text-xs text-primary-400 hover:underline flex items-center gap-1 font-medium"
              >
                {t('results.title')} <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentSubmissions.length === 0 ? (
              <p className="text-xs text-surface-400 italic py-4 text-center">
                No recent submissions recorded.
              </p>
            ) : (
              <div className="divide-y divide-surface-800/60">
                {recentSubmissions.map((sub) => (
                  <div
                    key={sub._id}
                    className="py-3 flex items-center justify-between gap-3 text-xs hover:bg-surface-800/30 rounded-lg px-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-surface-200 truncate">{sub.studentName}</p>
                      <p className="text-surface-400 text-xs truncate mt-0.5">
                        {sub.examTitle} • {formatRelativeTime(sub.submittedAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {sub.needsGrading ? (
                        <Badge variant="warning">{t('dashboard.pendingGrade') || 'Pending Grade'}</Badge>
                      ) : (
                        <span
                          className={`font-bold tabular-nums text-sm ${
                            sub.passed ? 'text-success-400' : 'text-danger-400'
                          }`}
                        >
                          {sub.percentage}%
                        </span>
                      )}

                      <Link
                        to="/admin/results"
                        className="p-1 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Categories Overview & Actions */}
        <div className="space-y-6">
          {/* Categories Overview */}
          <div className="glass-card p-5 rounded-xl border border-surface-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-surface-100 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-primary-400" />
                {t('dashboard.categoriesOverview')}
              </h2>
              <Link
                to="/admin/categories"
                className="text-xs text-primary-400 hover:underline flex items-center gap-1 font-medium"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {categoriesOverview.length === 0 ? (
              <p className="text-xs text-surface-400 italic py-4 text-center">
                No categories created yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {categoriesOverview.map((cat) => (
                  <Link
                    key={cat._id}
                    to={`/admin/students?categoryId=${cat._id}`}
                    className="p-3 rounded-xl bg-surface-900/50 hover:bg-surface-800/80 border border-surface-800 flex items-center justify-between transition-colors group block"
                  >
                    <div>
                      <p className="text-xs font-semibold text-surface-200 group-hover:text-primary-400 transition-colors">
                        {cat.name}
                      </p>
                      <p className="text-xs text-surface-500 mt-0.5">
                        {cat.studentCount} students • {cat.examCount} exams
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-500 group-hover:text-surface-200 transition-colors" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
