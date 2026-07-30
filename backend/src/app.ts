import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { api } from './routes.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  // ─── Security & hardening ──────────────────────────────────────────────────
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));

  // Global rate limit; auth endpoints get a stricter limiter.
  app.use('/api', rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }));
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, max: 50, message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many auth attempts, try again later' } } }));

  // ─── API ───────────────────────────────────────────────────────────────────
  app.use('/api', api);

  // ─── Errors ────────────────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
