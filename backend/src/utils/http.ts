import type { Request, Response, NextFunction } from 'express';

// Wraps async route handlers so thrown errors reach the error middleware.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

export function ok(res: Response, data: unknown, status = 200) {
  return res.status(status).json({ success: true, data });
}

export function paginated(res: Response, items: unknown[], total: number, page: number, pageSize: number) {
  return res.json({
    success: true,
    data: items,
    pagination: { total, page, pageSize, pages: Math.ceil(total / pageSize) },
  });
}

export function parsePagination(req: Request) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
