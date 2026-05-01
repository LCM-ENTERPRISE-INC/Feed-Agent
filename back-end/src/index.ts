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
import whatsAppService from './services/WhatsAppService';

// Initialize BullMQ Workers
import './queues/ocrQueue';

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

// ─────────────────────────────────────────────────────────────────────────────
// Express App Bootstrap
// ─────────────────────────────────────────────────────────────────────────────
const app = express();
const port = process.env.PORT || 3000;

// CORS — only allow the Vue 3 dashboard origin
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS policy: Origin '${origin}' is not allowed.`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

      // WhatsApp is initialized AFTER the HTTP server is up so that the
      // /api/whatsapp/status endpoint (Sprint 14) is already reachable when
      // the QR code is generated. Failure here is non-fatal.
      whatsAppService.initialize().catch((err: Error) => {
        logger.error(`[whatsapp]: Failed to initialize: ${err.message}`, { stack: err.stack });
      });
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`[startup]: Unable to start the server: ${err.message}`, { stack: err.stack });
    process.exit(1);
  }
}

startServer();
