import { Router } from 'express';
import authController from '../controllers/AuthController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new administrator
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:     { type: string, example: "João Admin" }
 *               email:    { type: string, example: "admin@feedagent.io" }
 *               password: { type: string, example: "Str0ng@Pass!" }
 *     responses:
 *       201:
 *         description: Registration successful — returns JWT and user profile.
 *       409:
 *         description: E-mail already registered.
 */
router.post('/register', authController.register.bind(authController));

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Authenticate and receive a JWT
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, example: "admin@feedagent.io" }
 *               password: { type: string, example: "Str0ng@Pass!" }
 *     responses:
 *       200:
 *         description: Login successful — returns JWT and user profile.
 *       401:
 *         description: Invalid credentials.
 */
router.post('/login', authController.login.bind(authController));

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get the authenticated user's profile
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile returned successfully.
 *       401:
 *         description: Missing or invalid Authorization header.
 */
router.get('/me', authMiddleware, authController.me.bind(authController));

export default router;
