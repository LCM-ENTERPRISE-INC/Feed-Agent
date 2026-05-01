import { Queue, Worker, Job } from 'bullmq';
import fs from 'fs';
import ocrService from '../services/OcrService';
import newsGeneratorService from '../services/NewsGeneratorService';
import logger from '../utils/logger';
import redisClient from '../utils/redisClient';

// ─────────────────────────────────────────────────────────────────────────────
// OCR Queue Setup
// ─────────────────────────────────────────────────────────────────────────────

export const OCR_QUEUE_NAME = 'ocr-processing-queue';

export const ocrQueue = new Queue(OCR_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Job Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface OcrJobData {
  filePath: string;
  mimetype: string;
  originalName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR Worker Definition
// ─────────────────────────────────────────────────────────────────────────────

export const ocrWorker = new Worker<OcrJobData>(
  OCR_QUEUE_NAME,
  async (job: Job<OcrJobData>) => {
    const { filePath, mimetype, originalName } = job.data;
    logger.info(`[ocr-worker]: Started processing job ${job.id} for file ${originalName}`);

    try {
      // 1. Report initial progress
      await job.updateProgress(10);

      // 2. Perform OCR
      const { text, confidence } = await ocrService.extractText(filePath, mimetype);

      await job.updateProgress(50); // OCR done, AI starting

      // 3. Generate JSON via Llama
      const articleJson = await newsGeneratorService.generateNewsFromOcr(text);

      await job.updateProgress(90);

      // 4. Cleanup temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      await job.updateProgress(100);
      logger.info(`[ocr-worker]: Completed job ${job.id} successfully.`);

      return {
        originalName,
        confidence,
        article: articleJson,
      };
    } catch (error) {
      // Ensure cleanup even on failure
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      logger.error(`[ocr-worker]: Job ${job.id} failed: ${(error as Error).message}`);
      throw error;
    }
  },
  {
    connection: redisClient,
    concurrency: 2, // Process up to 2 images concurrently
  }
);

ocrWorker.on('failed', (job, err) => {
  logger.error(`[ocr-worker]: Job ${job?.id} permanently failed: ${err.message}`);
});
