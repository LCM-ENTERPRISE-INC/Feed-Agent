import { Request, Response, NextFunction } from 'express';
import authService from '../services/AuthService';
import userService from '../services/UserService';
import { ApiResponse } from '../utils/ApiResponse';

/**
 * Handles HTTP transport for authentication flows.
 * Delegates all business logic to AuthService.
 */
export class AuthController {
  /**
   * POST /api/auth/register
   * Registers a new administrator account.
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        res.status(400).json({ success: false, error: 'name, email and password are required.' });
        return;
      }

      const result = await authService.register({ name, email, password });
      ApiResponse.success(res, result, 'Registration successful.', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/login
   * Authenticates a user and returns a signed JWT.
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ success: false, error: 'email and password are required.' });
        return;
      }

      const result = await authService.login({ email, password });
      ApiResponse.success(res, result, 'Login successful.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/me
   * Returns the profile of the currently authenticated user.
   * Requires a valid Bearer token (authMiddleware).
   */
  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const user = await userService.findById(userId);
      ApiResponse.success(res, user, 'User profile retrieved.');
    } catch (err) {
      next(err);
    }
  }
}

export default new AuthController();
