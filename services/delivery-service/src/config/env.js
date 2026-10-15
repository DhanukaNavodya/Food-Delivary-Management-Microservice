export const config = {
  serviceName: process.env.SERVICE_NAME || 'Delivery Service',
  port: Number(process.env.PORT) || 5004,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/delivery_db',
  orderServiceUrl: process.env.ORDER_SERVICE_URL || 'http://localhost:5003',
  restaurantServiceUrl: process.env.RESTAURANT_SERVICE_URL || 'http://localhost:5002'
};
