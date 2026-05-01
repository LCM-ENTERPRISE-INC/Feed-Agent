import { Response } from 'express';

export class ApiResponse {
  static success(res: Response, data: any, message: string = 'Success', statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(res: Response, error: string, statusCode: number = 500, details?: any) {
    return res.status(statusCode).json({
      success: false,
      error,
      details,
    });
  }
}
