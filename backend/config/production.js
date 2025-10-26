module.exports = {
  // Database configuration
  database: {
    url: process.env.DATABASE_URL
  },
  
  // Server configuration
  server: {
    port: process.env.PORT || 3005,
    cors: {
      origins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [
        'https://your-frontend-domain.vercel.app',
        'https://*.vercel.app',
        'http://localhost:5173'
      ]
    }
  },

  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET,
    bcryptRounds: 12
  }
}; 