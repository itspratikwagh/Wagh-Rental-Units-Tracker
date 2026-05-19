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

const config = {
  apiUrl: import.meta.env.VITE_API_URL || (
    import.meta.env.MODE === 'production'
      ? 'https://your-railway-backend-url.railway.app'  // Will be set via Railway environment variables
      : 'http://localhost:3005'
  )
};

export default config;