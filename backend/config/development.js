module.exports = {
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/wagh_rental_db'
  },
  server: {
    port: process.env.PORT || 3005,
    cors: {
      origins: ['http://localhost:5173', 'http://localhost:5174']
    }
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    bcryptRounds: 10
  }
}; 