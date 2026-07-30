import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { BadRequest } from '../utils/errors.js';

type Sources = { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema };

// Validates and coerces request parts against Zod schemas. On success the parsed
// (typed/coerced) values replace the raw ones.
export function validate(schemas: Sources) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
      if (schemas.params) Object.assign(req.params, schemas.params.parse(req.params));
      next();
    } catch (err: any) {
      const details = err?.errors?.map((e: any) => ({ path: e.path.join('.'), message: e.message }));
      next(BadRequest('Validation failed', details));
    }
  };
}
