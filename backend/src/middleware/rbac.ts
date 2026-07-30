import type { Request, Response, NextFunction } from 'express';
import { Forbidden, Unauthorized } from '../utils/errors.js';
import { hasPermission } from '../constants/index.js';

// Restrict a route to one or more roles.
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(Forbidden(`This action requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

// Restrict a route to holders of a fine-grained permission (see constants/Permissions).
export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(Unauthorized());
    if (!hasPermission(req.user.role, permission)) {
      return next(Forbidden(`Missing permission: ${permission}`));
    }
    next();
  };
}
