export const config = {
  serviceName: process.env.SERVICE_NAME || 'Order Service',
  port: Number(process.env.PORT) || 5003,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/order_db',
  restaurantServiceUrl: process.env.RESTAURANT_SERVICE_URL || 'http://localhost:5002',
  customerServiceUrl: process.env.CUSTOMER_SERVICE_URL || 'http://localhost:5005'
};
