export const config = {
  serviceName: process.env.SERVICE_NAME || 'Restaurant Service',
  port: Number(process.env.PORT) || 5002,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant_db',
  seedData: process.env.SEED_DATA !== 'false'
};
