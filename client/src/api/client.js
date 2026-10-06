import axios from 'axios';
import i18n from '../i18n';

const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Connection Status Listener system
const connectionListeners = new Set();
let connectionStatus = 'idle'; // 'idle' | 'connecting' | 'connected' | 'error'
let activeRequests = 0;
let slowTimer = null;
let recoveryTimer = null;

function notifyStatus(status) {
  connectionStatus = status;
  connectionListeners.forEach((fn) => fn(status));
}

export function subscribeConnectionStatus(listener) {
  connectionListeners.add(listener);
  listener(connectionStatus);
  return () => connectionListeners.delete(listener);
}

// Request interceptor: attach token & monitor latency
api.interceptors.request.use((config) => {
  if (!config.headers.Authorization) {
    const isStudentRoute = config.url && config.url.includes('/student');
    const studentToken = sessionStorage.getItem('studentExamToken');
    const adminToken = localStorage.getItem('token');

    if (isStudentRoute && studentToken) {
      config.headers.Authorization = `Bearer ${studentToken}`;
    } else if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    } else if (studentToken) {
      config.headers.Authorization = `Bearer ${studentToken}`;
    }
  }

  activeRequests++;
  if (slowTimer) clearTimeout(slowTimer);
  slowTimer = setTimeout(() => {
    if (activeRequests > 0) {
      notifyStatus('connecting');
    }
  }, 3000);

  return config;
});

// Response interceptor: handle auth errors & connection recovery
api.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0) {
      if (slowTimer) clearTimeout(slowTimer);
      if (connectionStatus === 'connecting' || connectionStatus === 'error') {
        notifyStatus('connected');
        if (recoveryTimer) clearTimeout(recoveryTimer);
        recoveryTimer = setTimeout(() => {
          notifyStatus('idle');
        }, 2500);
      }
    }
    return response;
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1);
    if (activeRequests === 0 && slowTimer) clearTimeout(slowTimer);

    if (!error.response || error.code === 'ERR_NETWORK') {
      notifyStatus('connecting');
    }

    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.startsWith('/exam/')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

// Health check with exponential backoff
export async function waitForServer(maxRetries = 6) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await api.get('/health', { timeout: 5000 });
      return true;
    } catch {
      const delay = Math.min(500 * Math.pow(2, i), 10000);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return false;
}

// Extract error message and code from axios errors
export function extractError(err, fallback = 'Something went wrong') {
  const rawCode = err.response?.data?.code || err.response?.status || null;
  const rawMessage = err.response?.data?.error || err.message || fallback;

  let message = rawMessage;
  if (rawCode && i18n.exists(`errors.${rawCode}`)) {
    message = i18n.t(`errors.${rawCode}`);
  }

  return { message, code: rawCode };
}

export default api;
