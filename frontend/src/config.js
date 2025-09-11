const config = {
  apiUrl: import.meta.env.VITE_API_URL || (
    import.meta.env.MODE === 'production'
      ? 'https://YOUR-NGROK-URL.ngrok.io'  // Replace with your actual ngrok URL
      : 'http://localhost:3005'
  )
};

export default config; 