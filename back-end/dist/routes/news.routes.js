"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const NewsController_1 = __importDefault(require("../controllers/NewsController"));
const uploadMiddleware_1 = require("../middlewares/uploadMiddleware");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const rateLimiter_1 = require("../middlewares/rateLimiter");
const router = (0, express_1.Router)();
// Protect all news routes
router.use(authMiddleware_1.authMiddleware);
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
router.post('/upload', rateLimiter_1.aiProcessingLimiter, uploadMiddleware_1.uploadNewsSource, NewsController_1.default.uploadSource.bind(NewsController_1.default));
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
router.get('/job/:jobId/stream', NewsController_1.default.streamJobStatus.bind(NewsController_1.default));
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
router.post('/generate-draft', rateLimiter_1.aiProcessingLimiter, uploadMiddleware_1.uploadNewsSource, NewsController_1.default.generateDraft.bind(NewsController_1.default));
/**
 * @openapi
 * /api/news/generate-ai-draft:
 *   post:
 *     summary: Generate a news draft from a URL or text using Llama 3
 *     description: Accepts a text snippet or URL, extracts its content, and runs a custom prompt through the local Llama model.
 *     tags: [News]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sourceContent:
 *                 type: string
 *               tone:
 *                 type: string
 *               length:
 *                 type: integer
 *               instructions:
 *                 type: string
 *     responses:
 *       200:
 *         description: Draft generated successfully.
 */
router.post('/generate-ai-draft', rateLimiter_1.aiProcessingLimiter, NewsController_1.default.generateAiDraft.bind(NewsController_1.default));
exports.default = router;
