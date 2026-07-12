export const EXPENSE_CATEGORIES = [
  'Airbnb',
  'Home Improvement',
  'Insurance',
  'Internet Bills',
  'Licenses & Permits',
  'Maintenance',
  'Mortgage',
  'Property Management',
  'Property Taxes',
  'Utility Bills',
  'Other',
];

import axios from 'axios';

const config = {
  apiUrl: import.meta.env.VITE_API_URL || (
    import.meta.env.MODE === 'production'
      ? 'https://your-railway-backend-url.railway.app'  // Will be set via Railway environment variables
      : 'http://localhost:3005'
  ),
  // Must match the backend's API_KEY env var (set VITE_API_KEY in the frontend build env)
  apiKey: import.meta.env.VITE_API_KEY || '',
};

// Attach the API key to every backend request — covers both axios and fetch
// so individual components don't need to change.
if (config.apiKey) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${config.apiKey}`;

  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.startsWith(config.apiUrl)) {
      init = { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${config.apiKey}` } };
    }
    return origFetch(input, init);
  };
}

export default config;