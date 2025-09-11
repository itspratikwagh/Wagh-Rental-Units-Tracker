const config = {
  apiUrl: import.meta.env.VITE_API_URL || (
    import.meta.env.MODE === 'production'
      ? 'https://wagh-rental-units-tracker-production-6a66.up.railway.app'  // Your Railway backend domain
      : 'http://localhost:3005'
  )
};

export default config; 