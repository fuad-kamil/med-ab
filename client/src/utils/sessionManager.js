/**
 * sessionManager.js
 *
 * Client-side single-device session manager.
 *
 * Responsibilities:
 *  - Generate & persist a per-browser device key (localStorage)
 *  - Start/stop a Web Worker heartbeat that renews the lease every ~15s
 *  - Handle pagehide: send soft-release beacon via navigator.sendBeacon
 *  - Handle visibility, online, bfcache (pageshow) events → immediate heartbeat
 *  - Skip heartbeat when autosave was made in the last 10s
 *  - On SESSION_REPLACED: clear all exam state and call the replaced callback
 *  - Export helpers for the login flow (getDeviceKey) and for autosave integration
 */

import api from '../api/client';

const DEVICE_KEY_LS_KEY = 'device_key';
const LAST_REQUEST_TS_KEY = 'session_last_request_ts';
const AUTOSAVE_DEBOUNCE_MS = 10_000;

// ─── Device key ──────────────────────────────────────────────────────────────

/** Get (or generate) the per-browser device key stored in localStorage */
export function getDeviceKey() {
  let key = localStorage.getItem(DEVICE_KEY_LS_KEY);
  if (!key || key.length < 32) {
    // Generate a random 256-bit hex key (32 bytes = 64 hex chars)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    key = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(DEVICE_KEY_LS_KEY, key);
  }
  return key;
}

// ─── Session manager class ────────────────────────────────────────────────────

let _instance = null;

class SessionManager {
  constructor() {
    this._worker = null;
    this._onReplaced = null;    // callback when SESSION_REPLACED
    this._onBlocked = null;     // callback when blockedSinceLast > 0
    this._token = null;
    this._pagehideHandler = null;
    this._visibilityHandler = null;
    this._onlineHandler = null;
    this._pageshowHandler = null;
    this._retryCount = 0;
    this._maxRetries = 5;
  }

  /**
   * start({ token, onReplaced, onBlocked })
   * Call this after a successful exam login. Pass the JWT token and callbacks.
   */
  start({ token, onReplaced, onBlocked } = {}) {
    this.stop(); // clean up any previous session
    this._token = token;
    this._onReplaced = onReplaced;
    this._onBlocked = onBlocked;
    this._retryCount = 0;

    this._startWorker();
    this._registerEventListeners();
  }

  /** Stop all timers and event listeners */
  stop() {
    if (this._worker) {
      this._worker.postMessage({ type: 'STOP' });
      this._worker.terminate();
      this._worker = null;
    }
    this._removeEventListeners();
    this._token = null;
    this._onReplaced = null;
    this._onBlocked = null;
  }

  /** Call this after every autosave so we skip the next heartbeat */
  notifyAutosave() {
    try {
      sessionStorage.setItem(LAST_REQUEST_TS_KEY, Date.now().toString());
    } catch {}
  }

  /** Update the token (e.g. after a session claim with waitToken) */
  updateToken(token) {
    this._token = token;
  }

  // ── Private: Web Worker ───────────────────────────────────────────────────

  _startWorker() {
    try {
      // Vite inlines the worker URL via ?worker&url — works with Vite's worker
      // handling when the file is in /src/workers/
      this._worker = new Worker(
        new URL('../workers/heartbeat.worker.js', import.meta.url),
        { type: 'module' }
      );
      this._worker.onmessage = (e) => {
        if (e.data?.type === 'TICK') this._onTick();
      };
      this._worker.onerror = (err) => {
        console.warn('[session] Worker error, falling back to setInterval:', err);
        this._worker = null;
        // Fallback: use setInterval on main thread
        this._fallbackTimer = setInterval(() => this._onTick(), 15_000);
      };
      this._worker.postMessage({ type: 'START' });
    } catch {
      // Web Workers not supported (very rare); use main-thread interval
      this._fallbackTimer = setInterval(() => this._onTick(), 15_000);
    }
  }

  _pingWorker() {
    if (this._worker) {
      this._worker.postMessage({ type: 'PING' });
    } else {
      this._onTick();
    }
  }

  // ── Private: Event listeners ──────────────────────────────────────────────

  _registerEventListeners() {
    this._pagehideHandler = () => this._onPagehide();
    this._visibilityHandler = () => {
      if (!document.hidden) this._pingWorker();
    };
    this._onlineHandler = () => this._pingWorker();
    this._pageshowHandler = (e) => {
      // bfcache restore: e.persisted === true
      if (e.persisted) this._pingWorker();
    };

    window.addEventListener('pagehide', this._pagehideHandler);
    document.addEventListener('visibilitychange', this._visibilityHandler);
    window.addEventListener('online', this._onlineHandler);
    window.addEventListener('pageshow', this._pageshowHandler);
  }

  _removeEventListeners() {
    if (this._pagehideHandler) {
      window.removeEventListener('pagehide', this._pagehideHandler);
      this._pagehideHandler = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    if (this._onlineHandler) {
      window.removeEventListener('online', this._onlineHandler);
      this._onlineHandler = null;
    }
    if (this._pageshowHandler) {
      window.removeEventListener('pageshow', this._pageshowHandler);
      this._pageshowHandler = null;
    }
    if (this._fallbackTimer) {
      clearInterval(this._fallbackTimer);
      this._fallbackTimer = null;
    }
  }

  // ── Private: Heartbeat tick ───────────────────────────────────────────────

  async _onTick() {
    if (!this._token) return;

    // Skip if we already made an autosave/request in the last 10s
    try {
      const lastTs = parseInt(sessionStorage.getItem(LAST_REQUEST_TS_KEY) || '0', 10);
      if (Date.now() - lastTs < AUTOSAVE_DEBOUNCE_MS) return;
    } catch {}

    try {
      sessionStorage.setItem(LAST_REQUEST_TS_KEY, Date.now().toString());

      const res = await api.post(
        '/api/student/session/heartbeat',
        {},
        {
          headers: {
            Authorization: `Bearer ${this._token}`,
            'X-Device-Key': getDeviceKey(),
          },
          timeout: 8000,
        }
      );

      this._retryCount = 0;

      const { blockedSinceLast } = res.data || {};
      if (blockedSinceLast > 0 && typeof this._onBlocked === 'function') {
        this._onBlocked(blockedSinceLast);
      }
    } catch (err) {
      const status = err.response?.status;
      const code = err.response?.data?.code;

      if (status === 401 && code === 'SESSION_REPLACED') {
        this._handleReplaced();
        return;
      }

      // Retry with backoff for network errors
      this._retryCount++;
      if (this._retryCount >= this._maxRetries) {
        console.warn('[session] Heartbeat failed too many times; will keep trying on next tick.');
        this._retryCount = 0;
      }
    }
  }

  // ── Private: pagehide soft release ───────────────────────────────────────

  _onPagehide() {
    if (!this._token) return;
    const body = JSON.stringify({ token: this._token });
    const url = `${_getApiBase()}/api/student/session/release-soft`;
    try {
      // sendBeacon uses text/plain to avoid preflight
      navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
    } catch {
      // Fallback: synchronous fetch with keepalive
      try {
        fetch(url, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'text/plain' },
          keepalive: true,
        }).catch(() => {});
      } catch {}
    }
  }

  // ── Private: SESSION_REPLACED handler ────────────────────────────────────

  _handleReplaced() {
    this.stop();
    // Clear all exam state from memory and storage
    clearAllExamState();
    if (typeof this._onReplaced === 'function') {
      this._onReplaced();
    }
  }
}

function _getApiBase() {
  // Match the logic in api/client.js
  const isProduction =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';
  return (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    (isProduction ? 'https://med-ab.onrender.com' : 'http://localhost:5000')
  );
}

// ─── Public: clear all exam state ────────────────────────────────────────────

export function clearAllExamState() {
  try {
    sessionStorage.removeItem('studentExamToken');
    sessionStorage.removeItem('studentMeta');
    sessionStorage.removeItem(LAST_REQUEST_TS_KEY);
    // Remove any exam_progress_* keys from localStorage
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('exam_progress_')) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    // Keep studentExamToken in localStorage for same-tab restore,
    // but we also clear it on SESSION_REPLACED to force re-login
    localStorage.removeItem('studentExamToken');
  } catch {}
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export function getSessionManager() {
  if (!_instance) _instance = new SessionManager();
  return _instance;
}

export default getSessionManager;
