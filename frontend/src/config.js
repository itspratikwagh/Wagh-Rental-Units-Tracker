const config = {
  apiUrl: import.meta.env.VITE_API_URL || (
    import.meta.env.MODE === 'production'
      ? 'https://your-railway-backend-url.railway.app'  // Will be set via Railway environment variables
      : 'http://localhost:3005'
  )
};

export default config; 