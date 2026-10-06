import { useState, useEffect, useCallback } from 'react';
import api, { extractError } from '../api/client';

let memoryCache = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds stale time

export function useDashboard() {
  const [data, setData] = useState(memoryCache);
  const [loading, setLoading] = useState(!memoryCache);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && memoryCache && now - lastFetchTime < CACHE_TTL) {
      setData(memoryCache);
      setLoading(false);
      return;
    }

    if (!memoryCache) {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await api.get('/api/admin/dashboard');
      const freshData = res.data;
      memoryCache = freshData;
      lastFetchTime = Date.now();
      setData(freshData);
    } catch (err) {
      setError(extractError(err, 'Failed to load dashboard data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchDashboard(true),
  };
}
