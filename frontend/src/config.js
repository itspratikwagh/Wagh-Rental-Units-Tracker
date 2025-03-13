const config = {
  apiUrl: process.env.NODE_ENV === 'production'
    ? 'https://your-railway-app-url.railway.app' // You'll replace this with your actual Railway URL
    : 'http://localhost:3003'
};

export default config; 