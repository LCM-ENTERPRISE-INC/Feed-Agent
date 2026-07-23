import { Router } from 'express';
import multer from 'multer';
import { WarmupProfileController } from '../controllers/WarmupProfileController';
import { WarmupMetricsController } from '../controllers/WarmupMetricsController';

const warmupRoutes = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * tags:
 *   name: Warmup
 *   description: Gerenciamento do ciclo de vida de aquecimento das instâncias do WhatsApp
 */

/**
 * @swagger
 * /api/warmup/{instanceId}/metrics:
 *   get:
 *     summary: Retrieve warmup metrics for an instance
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Metrics retrieved successfully
 */
warmupRoutes.get('/:instanceId/metrics', WarmupMetricsController.getMetrics);

/**
 * @swagger
 * /api/warmup/{instanceId}/start:
 *   post:
 *     summary: Start the warmup process for an instance
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Warmup started
 */
warmupRoutes.post('/:instanceId/start', WarmupProfileController.startWarmup);

/**
 * @swagger
 * /api/warmup/{instanceId}:
 *   get:
 *     summary: Get warmup profile status
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Profile retrieved
 */
warmupRoutes.get('/:instanceId', WarmupProfileController.getProfile);

/**
 * @swagger
 * /api/warmup/{instanceId}/status:
 *   put:
 *     summary: Update warmup status manually (e.g. pause/resume)
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 */
warmupRoutes.put('/:instanceId/status', WarmupProfileController.updateStatus);

/**
 * @swagger
 * /api/warmup/{instanceId}:
 *   delete:
 *     summary: Stop and delete warmup profile
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Warmup stopped and deleted
 */
warmupRoutes.delete('/:instanceId', WarmupProfileController.stopWarmup);

/**
 * @swagger
 * /api/warmup/{instanceId}/profile-picture:
 *   post:
 *     summary: Upload a profile picture for the instance
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Picture uploaded successfully
 */
warmupRoutes.post('/:instanceId/profile-picture', upload.single('image'), WarmupProfileController.uploadProfilePicture);

/**
 * @swagger
 * /api/warmup/{instanceId}/about:
 *   put:
 *     summary: Update the about (status) text of the instance
 *     tags: [Warmup]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               aboutText:
 *                 type: string
 *     responses:
 *       200:
 *         description: About text updated
 */
warmupRoutes.put('/:instanceId/about', WarmupProfileController.updateAboutStatus);

export default warmupRoutes;
