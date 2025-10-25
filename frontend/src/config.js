const config = {
  apiUrl: import.meta.env.VITE_API_URL || (
    import.meta.env.MODE === 'production'
      ? 'https://your-railway-backend-url.railway.app'  // Replace with your Railway backend URL
      : 'http://localhost:3005'
  )
};

export default config; 