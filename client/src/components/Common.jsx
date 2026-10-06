import { useTranslation } from 'react-i18next';

export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold text-surface-200 mb-1">{title}</h3>
      {message && (
        <p className="text-sm text-surface-500 max-w-sm">{message}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', code, onRetry }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-danger-600/10 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-danger-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-danger-500 mb-1">{t('common.error') || 'Error'}</h3>
      <p className="text-sm text-surface-400 max-w-sm mb-4">
        {message}{code ? ` (${code})` : ''}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 transition-colors cursor-pointer"
        >
          {t('common.tryAgain') || 'Try Again'}
        </button>
      )}
    </div>
  );
}

export function StatCard({ icon, label, value, color = 'primary' }) {
  const colors = {
    primary: 'from-primary-600/20 to-primary-900/10 border-primary-700/30',
    success: 'from-success-600/20 to-success-600/5 border-success-600/30',
    warning: 'from-warning-600/20 to-warning-600/5 border-warning-600/30',
    danger: 'from-danger-600/20 to-danger-600/5 border-danger-600/30',
  };

  return (
    <div
      className={`
        bg-gradient-to-br ${colors[color]}
        border rounded-2xl p-5
        transition-transform duration-200 hover:scale-[1.02]
      `}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-sm text-surface-400 font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold text-surface-100">{value}</p>
    </div>
  );
}

export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default: 'bg-surface-800 text-surface-300 border border-surface-700',
    success: 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80',
    warning: 'bg-amber-950/80 text-amber-300 border border-amber-800/80',
    danger: 'bg-rose-950/80 text-rose-300 border border-rose-800/80',
    primary: 'bg-primary-950/80 text-primary-300 border border-primary-800/80',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center px-2.5 py-1 rounded-full
        text-xs font-bold whitespace-nowrap shrink-0 select-none leading-none
        ${variants[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
