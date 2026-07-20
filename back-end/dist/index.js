"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const prismaClient_1 = __importDefault(require("./models/prismaClient"));
const mongoClient_1 = require("./models/mongoClient");
const logger_1 = __importDefault(require("./utils/logger"));
const errorHandler_1 = require("./middlewares/errorHandler");
const swagger_1 = require("./config/swagger");
const health_routes_1 = __importDefault(require("./routes/health.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const contacts_routes_1 = __importDefault(require("./routes/contacts.routes"));
const whatsapp_routes_1 = __importDefault(require("./routes/whatsapp.routes"));
const news_routes_1 = __importDefault(require("./routes/news.routes"));
const draft_routes_1 = __importDefault(require("./routes/draft.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const WhatsAppInstanceManager_1 = __importDefault(require("./services/WhatsAppInstanceManager"));
const cleanupCron_1 = require("./crons/cleanupCron");
// Initialize BullMQ Workers
require("./queues/ocrQueue");
require("./queues/broadcastQueue");
// ─────────────────────────────────────────────────────────────────────────────
// Global Process Error Guards — must be the first listeners registered
// ─────────────────────────────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
    logger_1.default.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    logger_1.default.error(`Unhandled Rejection: ${String(reason)}`);
    process.exit(1);
});
dotenv_1.default.config();
const helmet_1 = __importDefault(require("helmet"));
const rateLimiter_1 = require("./middlewares/rateLimiter");
// ─────────────────────────────────────────────────────────────────────────────
// Express App Bootstrap
// ─────────────────────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
exports.app = app;
const port = process.env.PORT || 3000;
// Security Headers
app.use((0, helmet_1.default)());
// Global Rate Limiting
app.use(rateLimiter_1.globalLimiter);
// CORS — only allow the Vue 3 dashboard origin
app.use((0, cors_1.default)());
// Body parsers
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Serve static uploads
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadsPath = path_1.default.resolve(process.cwd(), 'uploads');
if (!fs_1.default.existsSync(uploadsPath)) {
    fs_1.default.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express_1.default.static(uploadsPath));
// ─────────────────────────────────────────────────────────────────────────────
// Swagger UI  →  /api-docs
// ─────────────────────────────────────────────────────────────────────────────
(0, swagger_1.setupSwagger)(app);
// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
app.use('/health', health_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/contacts', contacts_routes_1.default);
app.use('/api/whatsapp', whatsapp_routes_1.default);
app.use('/api/news', news_routes_1.default);
app.use('/api/drafts', draft_routes_1.default);
app.use('/api/analytics', analytics_routes_1.default);
// ─────────────────────────────────────────────────────────────────────────────
// Global Error Handler — MUST be the last middleware
// ─────────────────────────────────────────────────────────────────────────────
app.use(errorHandler_1.errorHandler);
// ─────────────────────────────────────────────────────────────────────────────
// Server Startup
// ─────────────────────────────────────────────────────────────────────────────
async function startServer() {
    try {
        await prismaClient_1.default.$connect();
        logger_1.default.info('[postgres]: Connected to PostgreSQL successfully via Prisma.');
        await (0, mongoClient_1.connectMongoDB)();
        app.listen(port, () => {
            logger_1.default.info(`[server]: Running at http://localhost:${port}`);
            logger_1.default.info(`[swagger]: Docs available at http://localhost:${port}/api-docs`);
            // WhatsApp Manager initializes all DB instances
            WhatsAppInstanceManager_1.default.loadAllInstances().catch((err) => {
                logger_1.default.error(`[whatsapp-manager]: Failed to load instances: ${err.message}`, { stack: err.stack });
            });
            // Initialize Data Cleanup CRON jobs (Sprint 39)
            (0, cleanupCron_1.initCronJobs)();
        });
    }
    catch (error) {
        const err = error;
        logger_1.default.error(`[startup]: Unable to start the server: ${err.message}`, { stack: err.stack });
        process.exit(1);
    }
}
if (require.main === module) {
    startServer();
}
