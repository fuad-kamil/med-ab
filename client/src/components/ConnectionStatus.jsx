import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { subscribeConnectionStatus } from '../api/client';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function ConnectionStatus() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    return subscribeConnectionStatus(setStatus);
  }, []);

  if (status === 'idle') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1.5 transition-all animate-fade-in shrink-0"
    >
      {status === 'connecting' && (
        <span
          title={t('common.wakingUpServer') || 'Waking up the server…'}
          className="h-10 px-2.5 flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold"
        >
          <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" strokeWidth={2} />
          <span className="hidden sm:inline truncate">
            {t('common.wakingUpServer') || 'Waking up the server…'}
          </span>
        </span>
      )}

      {status === 'connected' && (
        <span
          title={t('common.connected') || 'Connected'}
          className="h-10 px-2.5 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={2} />
          <span className="hidden sm:inline truncate">{t('common.connected') || 'Connected'}</span>
        </span>
      )}
    </div>
  );
}
