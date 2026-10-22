/**
 * AccountInUseScreen.jsx
 *
 * Shown after correct credentials when the server returns ACCOUNT_IN_USE.
 * Automatically retries /api/student/session/claim every 4s (first minute),
 * then every 8s, up to 3 minutes, then shows "Tap Try now".
 * Never stores the password — uses the waitToken for retries.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { MonitorSmartphone, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { getDeviceKey } from '../utils/sessionManager';

export default function AccountInUseScreen({
  waitToken,
  accessToken,
  onSuccess,   // called with { token, ...loginData } when claim succeeds
  onBack,      // called when user presses Back
}) {
  const { t } = useTranslation();

  const [secondsUntilRetry, setSecondsUntilRetry] = useState(4);
  const [paused, setPaused] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);
  const retryIntervalRef = useRef(null);
  const elapsedRef = useRef(0);

  const tryClaim = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await api.post(
        '/api/student/session/claim',
        { waitToken },
        {
          headers: {
            'X-Device-Key': getDeviceKey(),
          },
        }
      );
      // Success — pass token and login data up
      onSuccess(res.data);
    } catch (err) {
      const status = err.response?.status;
      const code = err.response?.data?.code;

      if (status === 401) {
        // waitToken expired — stop retrying, show error
        setPaused(true);
        return;
      }
      if (status === 409 && code === 'ACCOUNT_IN_USE') {
        // Still blocked — keep retrying
      }
      // Other error — keep retrying
    } finally {
      setRetrying(false);
    }
  }, [waitToken, onSuccess, retrying]);

  // Polling timer with adaptive interval
  useEffect(() => {
    const FIRST_PHASE_MS = 60_000;   // first 60s: every 4s
    const MAX_WAIT_MS = 180_000;     // after 3 min: pause and show button

    let countdownTarget = 4;

    const tick = () => {
      elapsedRef.current = Date.now() - startTimeRef.current;

      if (elapsedRef.current >= MAX_WAIT_MS) {
        clearInterval(retryIntervalRef.current);
        setPaused(true);
        return;
      }

      countdownTarget = elapsedRef.current < FIRST_PHASE_MS ? 4 : 8;
    };

    // Countdown display
    timerRef.current = setInterval(() => {
      setSecondsUntilRetry((prev) => {
        if (prev <= 1) {
          const elapsed = Date.now() - startTimeRef.current;
          const next = elapsed < 60_000 ? 4 : 8;
          // Trigger a claim attempt
          tryClaim();
          return next;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(retryIntervalRef.current);
    };
  }, [tryClaim]);

  // Pause countdown when token expires or max wait reached
  useEffect(() => {
    if (paused) {
      clearInterval(timerRef.current);
    }
  }, [paused]);

  const handleTryNow = () => {
    setSecondsUntilRetry(4);
    setPaused(false);
    startTimeRef.current = Date.now();
    tryClaim();
  };

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="w-full max-w-md glass-card p-6 sm:p-8 rounded-2xl border border-amber-500/30 dark:border-amber-900/50 shadow-2xl space-y-5 animate-slide-up"
    >
      {/* Icon */}
      <div className="flex justify-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500">
          <MonitorSmartphone className="w-8 h-8" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-surface-900 dark:text-surface-100">
          {t('session.accountInUseTitle')}
        </h2>
        <p className="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
          {t('session.accountInUseBody')}
        </p>
      </div>

      {/* Live status */}
      <div
        aria-live="polite"
        className="text-center text-sm text-surface-500 dark:text-surface-400"
      >
        {paused ? (
          <span>{t('session.accountInUsePaused')}</span>
        ) : (
          <span className={reduceMotion ? '' : 'tabular-nums'}>
            {t('session.accountInUseCountdown', { seconds: secondsUntilRetry })}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {!paused && !reduceMotion && (
        <div className="h-1 bg-surface-200 dark:bg-surface-800 rounded-full overflow-hidden">
          <div
            key={secondsUntilRetry}
            className="h-full bg-amber-400 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${(secondsUntilRetry / (elapsedRef.current < 60_000 ? 4 : 8)) * 100}%` }}
          />
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col gap-3">
        <button
          id="account-in-use-try-now"
          onClick={handleTryNow}
          disabled={retrying}
          className="w-full min-h-[48px] px-4 py-3 rounded-xl font-semibold text-sm bg-amber-500 hover:bg-amber-400 text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {retrying ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : null}
          {t('session.tryNow')}
        </button>
        <button
          id="account-in-use-back"
          onClick={onBack}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl font-medium text-sm border border-surface-300 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
        >
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}
