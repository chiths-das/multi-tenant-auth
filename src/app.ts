import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { getEnv } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { globalLimiter, authLimiter } from './middleware/rateLimiter.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import { tenantRouter } from './modules/tenants/tenant.routes.js';
import { providerRouter } from './modules/providers/provider.routes.js';
import { rbacRouter } from './modules/rbac/rbac.routes.js';

export function createApp() {
  const app = express();
  const env = getEnv();

  app.use(helmet());
  app.use(cors({
    origin: env.CORS_ORIGINS.split(',').map(s => s.trim()),
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  if (env.NODE_ENV !== 'test') {
    app.use(globalLimiter);
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  if (env.NODE_ENV !== 'test') {
    app.use('/auth', authLimiter);
  }

  app.use('/auth', authRouter);
  app.use('/users', userRouter);
  app.use('/tenants', tenantRouter);
  app.use('/tenants', providerRouter);
  app.use('/tenants', rbacRouter);

  app.use(errorHandler);

  return app;
}
