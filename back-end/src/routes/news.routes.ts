import { Router } from 'express';
import newsController from '../controllers/NewsController';
import { uploadNewsSource } from '../middlewares/uploadMiddleware';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

// Protect all news routes
router.use(authMiddleware);

/**
 * @openapi
 * /api/news/upload:
 *   post:
 *     summary: Upload a news source (image or PDF)
 *     description: >
 *       Accepts multipart/form-data. The file will be saved temporarily on the server
 *       for subsequent OCR processing. Allowed types: JPEG, PNG, PDF. Max size: 10MB.
 *     tags: [News]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "The news image or PDF file to process."
 *     responses:
 *       201:
 *         description: File uploaded successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:        { type: string }
 *                 originalName: { type: string }
 *                 mimetype:     { type: string }
 *                 size:         { type: integer }
 *       400:
 *         description: No file provided.
 *       415:
 *         description: Invalid file type.
 */
router.post('/upload', uploadNewsSource, newsController.uploadSource.bind(newsController));

/**
 * @openapi
 * /api/news/job/{jobId}/stream:
 *   get:
 *     summary: Real-time OCR processing status
 *     description: >
 *       Server-Sent Events (SSE) endpoint to monitor the progress of an OCR extraction job.
 *       Events emitted: `progress`, `completed`, `failed`.
 *     tags: [News]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: SSE stream (text/event-stream)
 *       404:
 *         description: Job not found
 */
router.get('/job/:jobId/stream', newsController.streamJobStatus.bind(newsController));

/**
 * @openapi
 * /api/news/generate-draft:
 *   post:
 *     summary: Generate a news draft synchronously
 *     description: Uploads an image or PDF, extracts text via OCR, and generates a structured news draft using the Llama AI model. Blocks until completed.
 *     tags: [News]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The image or PDF file to process.
 *     responses:
 *       200:
 *         description: Draft generated successfully.
 *       400:
 *         description: No file provided.
 *       415:
 *         description: Invalid file type.
 *       422:
 *         description: Image is unreadable or OCR confidence is below 60%.
 */
router.post('/generate-draft', uploadNewsSource, newsController.generateDraft.bind(newsController));

export default router;
