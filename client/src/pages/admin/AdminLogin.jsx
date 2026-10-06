import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { ServerWaking } from '../../components/Spinner';
import { waitForServer } from '../../api/client';
import PreferencesControls from '../../components/PreferencesControls';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const { t } = useTranslation();
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [checkingServer, setCheckingServer] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin', { replace: true });
      return;
    }
    waitForServer().then((ok) => {
      setServerReady(ok);
      setCheckingServer(false);
    });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login({ fullName, password });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || t('errors.GENERIC') || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingServer) {
    return <ServerWaking />;
  }

  return (
    <div className="min-h-[100dvh] relative flex items-center justify-center p-4 sm:p-6 bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 transition-colors">
      {/* Top Right Preferences */}
      <div className="absolute top-4 right-4 z-50">
        <PreferencesControls />
      </div>

      <div className="w-full max-w-sm animate-slide-up space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-600/10 dark:bg-teal-500/20 border border-teal-500/30 text-teal-600 dark:text-teal-400 shadow-md shadow-teal-600/10 mb-1">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
            {t('common.appName')}
          </h1>
          <div className="font-arabic text-xl text-teal-600 dark:text-teal-400 text-center dir-rtl py-1 select-none" dir="rtl">
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </div>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {t('exam.ustazAdminLogin')}
          </p>
        </div>

        {!serverReady && (
          <div className="p-3 rounded-xl bg-warning-500/10 border border-warning-500/20 text-warning-600 dark:text-warning-400 text-xs text-center">
            {t('exam.serverUnavailable')}
          </div>
        )}

        <form id="admin-login-form" onSubmit={handleSubmit} className="glass-card p-5 sm:p-6 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-xl space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-600 dark:text-danger-400 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <Input
            label={t('exam.fullNameOrUsername')}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Ustaz Admin"
            required
            autoComplete="username"
            id="admin-username-field"
            className="text-base min-h-[44px]"
          />

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider">
              {t('students.password')}
            </label>
            <div className="relative">
              <input
                id="admin-password-field"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 pr-10 text-base rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[44px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            loading={loading}
            disabled={!serverReady || loading}
            className="w-full min-h-[44px]"
            size="lg"
          >
            {t('exam.signIn')}
          </Button>
        </form>
      </div>
    </div>
  );
}
