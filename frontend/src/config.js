const config = {
  apiUrl: import.meta.env.VITE_API_URL || (
    import.meta.env.MODE === 'production'
      ? 'https://your-backend-domain.railway.app'  // Replace with your actual backend domain
      : 'http://localhost:3005'
  )
};

export default config; 