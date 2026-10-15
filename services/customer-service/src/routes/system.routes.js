import { Router } from 'express';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import { isDBConnected } from '../config/db.js';
import { config } from '../config/env.js';

// Operational endpoints shared by every service:
//   GET /                      service info
//   GET /health                liveness (used by Docker/ECS health checks), always 200 while the process runs
//   GET /db-check              MongoDB connection state
//   GET <apiPrefix>/health     readiness, 503 while the database is down
//   GET /api/docs              Swagger UI
export function systemRoutes({ apiPrefix, openApiSpec }) {
  const router = Router();
  const database = () => (isDBConnected() ? 'UP' : 'DOWN');

  router.get('/', (req, res) => {
    res.json({ service: config.serviceName, port: config.port, status: 'running', docs: '/api/docs' });
  });

  router.get('/health', (req, res) => {
    res.json({ service: config.serviceName, status: 'UP', database: database() });
  });

  router.get('/db-check', (req, res) => {
    res.json({
      service: config.serviceName,
      dbConnected: isDBConnected(),
      mongoState: mongoose.connection.readyState,
      database: mongoose.connection.name || null
    });
  });

  router.get(`${apiPrefix}/health`, (req, res) => {
    const up = isDBConnected();
    res.status(up ? 200 : 503).json({ service: config.serviceName, status: up ? 'UP' : 'DOWN', database: database() });
  });

  router.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customSiteTitle: `${config.serviceName} API`
  }));

  return router;
}
