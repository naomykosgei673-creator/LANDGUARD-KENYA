import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { Unauthorized } from '../utils/errors.js';

// Extracts and verifies the Bearer access token; attaches req.user.
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(Unauthorized('Missing or malformed Authorization header'));
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(Unauthorized('Invalid or expired access token'));
  }
}

// Optional auth — attaches user if a valid token is present, else continues anonymously.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(header.slice(7));
    } catch {
      /* ignore — anonymous */
    }
  }
  next();
}
