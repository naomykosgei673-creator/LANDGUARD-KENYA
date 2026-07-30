// Typed application errors → consistent HTTP responses via the error middleware.
export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;

  constructor(statusCode: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const BadRequest = (msg: string, details?: unknown) => new AppError(400, msg, 'BAD_REQUEST', details);
export const Unauthorized = (msg = 'Authentication required') => new AppError(401, msg, 'UNAUTHORIZED');
export const Forbidden = (msg = 'You do not have permission to perform this action') => new AppError(403, msg, 'FORBIDDEN');
export const NotFound = (msg = 'Resource not found') => new AppError(404, msg, 'NOT_FOUND');
export const Conflict = (msg: string) => new AppError(409, msg, 'CONFLICT');
