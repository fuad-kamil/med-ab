import { useTranslation } from 'react-i18next';

export function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-10 w-10',
    xl: 'h-16 w-16',
  };

  return (
    <svg
      className={`animate-spin ${sizes[size]} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Spinner size="xl" className="text-primary-500" />
      <p className="text-surface-400 text-sm animate-pulse">{message}</p>
    </div>
  );
}

export function ServerWaking() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="relative">
        <Spinner size="xl" className="text-primary-500" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl">☁️</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-surface-200 font-medium">{t('common.wakingUpServer') || 'Waking up server...'}</p>
        <p className="text-surface-500 text-sm mt-1">
          {t('common.wakingUpSub') || 'Free servers sleep after inactivity. This takes 15–30 seconds.'}
        </p>
      </div>
    </div>
  );
}

export default Spinner;
