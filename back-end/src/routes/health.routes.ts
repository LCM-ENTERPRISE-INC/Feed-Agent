import { Router, Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: API Health Check
 *     description: Returns the health status of the API
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: API is running smoothly.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Feed Agent AI - API is healthy!
 */
router.get('/', (req: Request, res: Response) => {
  ApiResponse.success(res, null, 'Feed Agent AI - API is healthy!');
});

export default router;
