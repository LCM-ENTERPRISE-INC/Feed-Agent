import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import logger from '../utils/logger';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(`Operational Error: ${err.message}`);
    return ApiResponse.error(res, err.message, err.statusCode);
  }

  // Log unexpected errors
  logger.error(`Unexpected Error: ${err.message}`, { stack: err.stack });

  // Do not leak error details in production
  const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  const details = process.env.NODE_ENV === 'production' ? undefined : err.stack;

  return ApiResponse.error(res, message, 500, details);
};
