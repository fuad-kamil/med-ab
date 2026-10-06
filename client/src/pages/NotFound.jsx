import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center animate-slide-up">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-3xl font-bold text-surface-200 mb-2">404</h1>
        <p className="text-surface-500 mb-6">{t('errors.pageNotFound') || 'Page not found'}</p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
        >
          ← {t('common.goHome') || 'Go Home'}
        </a>
      </div>
    </div>
  );
}
