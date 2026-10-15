export const config = {
  serviceName: process.env.SERVICE_NAME || 'Auth Service',
  port: Number(process.env.PORT) || 5001,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD
};
