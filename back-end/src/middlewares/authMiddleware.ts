import { Request, Response, NextFunction } from 'express';
import authService, { AuthPayload } from '../services/AuthService';
import { AppError } from '../utils/AppError';

// Extend Express Request to carry the authenticated user payload
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Middleware that validates a JWT from either:
 *  1. The `Authorization: Bearer <token>` header (standard REST clients), or
 *  2. The `?token=<jwt>` query parameter (required for SSE EventSource streams,
 *     which cannot set custom headers in the browser).
 *
 * Attaches the decoded payload to `req.user` on success.
 * Throws AppError (401) if no valid token is found in either location.
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  // 1. Try Authorization header first (preferred, most secure)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  // 2. Fallback: query param (SSE streams via native EventSource)
  if (!token && req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return next(new AppError('Authorization token missing. Provide a Bearer header or ?token= query param.', 401));
  }

  try {
    const payload = authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    next(err);
  }
};

