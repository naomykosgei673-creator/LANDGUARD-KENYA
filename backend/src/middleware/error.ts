import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }

  // Prisma unique-constraint violation → 409
  const anyErr = err as any;
  if (anyErr?.code === 'P2002') {
    const target = anyErr?.meta?.target;
    return res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: `A record with this ${Array.isArray(target) ? target.join(', ') : 'value'} already exists` },
    });
  }
  if (anyErr?.code === 'P2025') {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Record not found' } });
  }

  logger.error('Unhandled error', { message: anyErr?.message, stack: anyErr?.stack });
  res.status(500).json({ success: false, error: { code: 'INTERNAL', message: 'An unexpected error occurred' } });
}
