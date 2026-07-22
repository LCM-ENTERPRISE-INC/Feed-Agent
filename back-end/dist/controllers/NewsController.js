"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsController = void 0;
const ApiResponse_1 = require("../utils/ApiResponse");
const AppError_1 = require("../utils/AppError");
const ocrQueue_1 = require("../queues/ocrQueue");
const OcrService_1 = __importDefault(require("../services/OcrService"));
const NewsGeneratorService_1 = __importDefault(require("../services/NewsGeneratorService"));
const DraftService_1 = __importDefault(require("../services/DraftService"));
const bullmq_1 = require("bullmq");
const fs_1 = __importDefault(require("fs"));
const UrlScraperService_1 = __importDefault(require("../services/UrlScraperService"));
class NewsController {
    /**
     * POST /api/news/upload
     * Endpoint for uploading a news source image/pdf.
     * Dispatches the file to a Redis queue (BullMQ) for async OCR.
     */
    async uploadSource(req, res, next) {
        try {
            if (!req.file) {
                throw new AppError_1.AppError('No file provided or invalid file type.', 400);
            }
            // Add to BullMQ OCR Queue
            const job = await ocrQueue_1.ocrQueue.add(ocrQueue_1.OCR_QUEUE_NAME, {
                filePath: req.file.path,
                mimetype: req.file.mimetype,
                originalName: req.file.originalname,
                userId: req.user.userId, // Pass user ID to worker for draft persistence
            });
            const payload = {
                jobId: job.id,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
            };
            ApiResponse_1.ApiResponse.success(res, payload, 'File queued for OCR processing.', 202);
        }
        catch (err) {
            if (req.file?.path && fs_1.default.existsSync(req.file.path)) {
                fs_1.default.unlinkSync(req.file.path);
            }
            next(err);
        }
    }
    /**
     * GET /api/news/job/:jobId/stream
     * Provides real-time SSE updates for the OCR job status.
     */
    async streamJobStatus(req, res, next) {
        const { jobId } = req.params;
        if (!jobId) {
            res.status(400).json({ error: 'jobId parameter is required' });
            return;
        }
        try {
            const job = await bullmq_1.Job.fromId(ocrQueue_1.ocrQueue, jobId);
            if (!job) {
                throw new AppError_1.AppError('Job not found.', 404);
            }
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();
            const pushEvent = (event, data) => {
                res.write(`event: ${event}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };
            const sendCurrentState = async () => {
                const state = await job.getState();
                const progress = job.progress;
                if (state === 'completed') {
                    pushEvent('completed', job.returnvalue);
                    clearInterval(interval);
                    res.end();
                }
                else if (state === 'failed') {
                    pushEvent('failed', { error: job.failedReason });
                    clearInterval(interval);
                    res.end();
                }
                else {
                    pushEvent('progress', { state, progress });
                }
            };
            // Initial state
            await sendCurrentState();
            // Poll job state every 1 second
            const interval = setInterval(async () => {
                await sendCurrentState();
            }, 1000);
            req.on('close', () => {
                clearInterval(interval);
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/news/generate-draft
     * Synchronous endpoint that receives an image, runs OCR, extracts JSON via LLM,
     * and returns the resulting draft along with processing metrics.
     */
    async generateDraft(req, res, next) {
        const startTime = Date.now();
        try {
            if (!req.file) {
                throw new AppError_1.AppError('No file provided or invalid file type.', 400);
            }
            // 1. Perform OCR
            const { text, confidence } = await OcrService_1.default.extractText(req.file.path, req.file.mimetype);
            // 2. Generate JSON via Llama
            const articleJson = await NewsGeneratorService_1.default.generateNewsFromOcr(text);
            // 3. Save draft to Database (include imagePath)
            const draft = await DraftService_1.default.createDraft(req.user.userId, text, articleJson, req.file.path);
            // 4. Note: We no longer delete the temp file here because it might be sent via WhatsApp.
            // The daily cron job will clean up old files after 24h.
            const processingTimeMs = Date.now() - startTime;
            const payload = {
                draftId: draft.id,
                originalName: req.file.originalname,
                confidence: Number(confidence.toFixed(2)),
                processingTimeMs,
                article: articleJson,
            };
            ApiResponse_1.ApiResponse.success(res, payload, 'News draft generated successfully.', 200);
        }
        catch (err) {
            if (req.file?.path && fs_1.default.existsSync(req.file.path)) {
                fs_1.default.unlinkSync(req.file.path);
            }
            next(err);
        }
    }
    /**
     * POST /api/news/generate-ai-draft
     * Endpoint for generating a draft from a URL or raw text input via Llama 3
     */
    async generateAiDraft(req, res, next) {
        const startTime = Date.now();
        try {
            const { sourceContent, tone, length, instructions } = req.body;
            if (!sourceContent || typeof sourceContent !== 'string') {
                throw new AppError_1.AppError('sourceContent is required.', 400);
            }
            let textToProcess = sourceContent;
            let sourceLabel = 'Texto Fornecido Pelo Usuário';
            // Verify if sourceContent is a URL
            const isUrl = /^https?:\/\//i.test(sourceContent.trim());
            if (isUrl) {
                textToProcess = await UrlScraperService_1.default.extractTextFromUrl(sourceContent.trim());
                sourceLabel = sourceContent.trim();
            }
            // Generate Draft
            const articleJson = await NewsGeneratorService_1.default.generateCustomDraft(textToProcess, tone || 'Informativo', length || 500, instructions || '', sourceLabel);
            // Save to database
            const draft = await DraftService_1.default.createDraft(req.user.userId, textToProcess, articleJson);
            const processingTimeMs = Date.now() - startTime;
            const payload = {
                draftId: draft.id,
                processingTimeMs,
                article: articleJson,
            };
            ApiResponse_1.ApiResponse.success(res, payload, 'AI Draft generated successfully.', 200);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.NewsController = NewsController;
exports.default = new NewsController();
