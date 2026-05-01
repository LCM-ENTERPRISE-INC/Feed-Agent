import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import { ocrQueue, OCR_QUEUE_NAME } from '../queues/ocrQueue';
import ocrService from '../services/OcrService';
import newsGeneratorService from '../services/NewsGeneratorService';
import { Job } from 'bullmq';
import logger from '../utils/logger';
import fs from 'fs';

export class NewsController {
  /**
   * POST /api/news/upload
   * Endpoint for uploading a news source image/pdf.
   * Dispatches the file to a Redis queue (BullMQ) for async OCR.
   */
  async uploadSource(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('No file provided or invalid file type.', 400);
      }

      // Add to BullMQ OCR Queue
      const job = await ocrQueue.add(OCR_QUEUE_NAME, {
        filePath: req.file.path,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
      });

      const payload = {
        jobId: job.id,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      };

      ApiResponse.success(res, payload, 'File queued for OCR processing.', 202);
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(err);
    }
  }

  /**
   * GET /api/news/job/:jobId/stream
   * Provides real-time SSE updates for the OCR job status.
   */
  async streamJobStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { jobId } = req.params;
    
    if (!jobId) {
       res.status(400).json({ error: 'jobId parameter is required' });
       return;
    }

    try {
      const job = await Job.fromId(ocrQueue, jobId as string);
      if (!job) {
        throw new AppError('Job not found.', 404);
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const pushEvent = (event: string, data: any) => {
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
        } else if (state === 'failed') {
          pushEvent('failed', { error: job.failedReason });
          clearInterval(interval);
          res.end();
        } else {
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
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/news/generate-draft
   * Synchronous endpoint that receives an image, runs OCR, extracts JSON via LLM,
   * and returns the resulting draft along with processing metrics.
   */
  async generateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();

    try {
      if (!req.file) {
        throw new AppError('No file provided or invalid file type.', 400);
      }

      // 1. Perform OCR
      const { text, confidence } = await ocrService.extractText(req.file.path, req.file.mimetype);

      // 2. Generate JSON via Llama
      const articleJson = await newsGeneratorService.generateNewsFromOcr(text);

      // 3. Cleanup temp file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      const processingTimeMs = Date.now() - startTime;

      const payload = {
        originalName: req.file.originalname,
        confidence: Number(confidence.toFixed(2)),
        processingTimeMs,
        article: articleJson,
      };

      ApiResponse.success(res, payload, 'News draft generated successfully.', 200);
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(err);
    }
  }
}

export default new NewsController();
