export const config = {
  serviceName: process.env.SERVICE_NAME || 'Customer Service',
  port: Number(process.env.PORT) || 5005,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/customer_db'
};
