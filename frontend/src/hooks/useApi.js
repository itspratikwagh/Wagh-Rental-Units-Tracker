import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config';

/**
 * Reusable hook that wraps axios calls with loading, error, and data states.
 * @param {string} url - API endpoint path (e.g., '/api/payments')
 * @param {object} options - Optional configuration
 * @param {boolean} options.immediate - Whether to fetch immediately (default: true)
 * @returns {{ data: any, loading: boolean, error: string|null, refetch: function }}
 */
const useApi = (url, options = {}) => {
  const { immediate = true } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const fullUrl = url.startsWith('http') ? url : `${config.apiUrl}${url}`;

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(fullUrl);
      setData(response.data);
      return response.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'An error occurred';
      setError(message);
      console.error(`Error fetching ${url}:`, err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fullUrl, url]);

  useEffect(() => {
    if (immediate) {
      refetch();
    }
  }, [immediate, refetch]);

  return { data, loading, error, refetch };
};

export default useApi;
