import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import prisma from './models/prismaClient';
import { connectMongoDB } from './models/mongoClient';
import logger from './utils/logger';
import { errorHandler } from './middlewares/errorHandler';
import { setupSwagger } from './config/swagger';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import contactsRoutes from './routes/contacts.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import newsRoutes from './routes/news.routes';
import draftRoutes from './routes/draft.routes';
import analyticsRoutes from './routes/analytics.routes';
import whatsAppInstanceManager from './services/WhatsAppInstanceManager';
import feedHistoryService from './services/FeedHistoryService';
import { initCronJobs } from './crons/cleanupCron';

// Initialize BullMQ Workers
import './queues/ocrQueue';
import './queues/broadcastQueue';

// ─────────────────────────────────────────────────────────────────────────────
// Global Process Error Guards — must be the first listeners registered
// ─────────────────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err: Error) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`Unhandled Rejection: ${String(reason)}`);
  process.exit(1);
});

dotenv.config();

import helmet from 'helmet';
import { globalLimiter } from './middlewares/rateLimiter';
import { resolveTrustProxyHops } from './config/trustProxy';

// ─────────────────────────────────────────────────────────────────────────────
// Express App Bootstrap
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 3000;

// Trust a single nginx hop so rate-limit / req.ip see the real client IP
app.set('trust proxy', resolveTrustProxyHops());

// Security Headers
app.use(helmet());

// Global Rate Limiting
app.use(globalLimiter);

// CORS — only allow the Vue 3 dashboard origin
app.use(cors());

// Body parsers
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploads
import path from 'path';
import fs from 'fs';
const uploadsPath = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// ─────────────────────────────────────────────────────────────────────────────
// Swagger UI  →  /api-docs
// ─────────────────────────────────────────────────────────────────────────────
setupSwagger(app);

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/analytics', analyticsRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler — MUST be the last middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Server Startup
// ─────────────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await prisma.$connect();
    logger.info('[postgres]: Connected to PostgreSQL successfully via Prisma.');

    await connectMongoDB();

    app.listen(port, () => {
      logger.info(`[server]: Running at http://localhost:${port}`);
      logger.info(`[swagger]: Docs available at http://localhost:${port}/api-docs`);

      // WhatsApp Manager initializes all DB instances
      whatsAppInstanceManager.loadAllInstances().catch((err: Error) => {
        logger.error(`[whatsapp-manager]: Failed to load instances: ${err.message}`, { stack: err.stack });
      });

      // Initialize Data Cleanup CRON jobs (Sprint 39)
      initCronJobs();
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`[startup]: Unable to start the server: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
}

export { app };

if (require.main === module) {
  startServer();
}
