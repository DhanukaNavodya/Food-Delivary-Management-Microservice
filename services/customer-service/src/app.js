import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { openApiSpec } from './docs/openapi.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import customerRoutes from './routes/customer.routes.js';
import { systemRoutes } from './routes/system.routes.js';

export const app = express();

// Swagger UI is served over plain HTTP behind the load balancer, so the CSP header is disabled.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  // Docker/ECS health checks hit /health every few seconds; keep them out of the logs.
  skip: (req) => req.path === '/health'
}));

app.use(systemRoutes({ apiPrefix: '/api/customers', openApiSpec }));
app.use('/api/customers', customerRoutes);

app.use(notFound);
app.use(errorHandler);

export const onStartup = async () => {};
