"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppController = void 0;
const WhatsAppInstanceManager_1 = __importDefault(require("../services/WhatsAppInstanceManager"));
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const ApiResponse_1 = require("../utils/ApiResponse");
const AppError_1 = require("../utils/AppError");
const logger_1 = __importDefault(require("../utils/logger"));
// SSE heartbeat interval (keep connection alive through proxies/load-balancers)
const SSE_HEARTBEAT_MS = 25_000;
/**
 * Handles HTTP endpoints for WhatsApp connection management.
 */
class WhatsAppController {
    /**
     * GET /api/whatsapp/instances
     * Returns all WhatsApp instances for the authenticated user along with their live state.
     */
    async getInstances(req, res, next) {
        try {
            const userId = req.user.userId;
            const dbInstances = await prismaClient_1.default.whatsAppInstance.findMany({
                where: { userId },
                orderBy: { id: 'asc' }
            });
            const instances = dbInstances.map((inst) => {
                const liveInstance = WhatsAppInstanceManager_1.default.getInstance(inst.id);
                const liveStatus = liveInstance ? liveInstance.getStatus() : { state: 'DISCONNECTED' };
                return {
                    id: inst.id,
                    name: inst.name,
                    dbStatus: inst.status,
                    liveStatus
                };
            });
            ApiResponse_1.ApiResponse.success(res, instances, 'WhatsApp instances retrieved.');
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/whatsapp/instances
     * Creates a new WhatsApp instance slot for the user. Max 5 slots allowed.
     */
    async createInstance(req, res, next) {
        try {
            const userId = req.user.userId;
            const { name } = req.body;
            const currentCount = await prismaClient_1.default.whatsAppInstance.count({ where: { userId } });
            if (currentCount >= 500) {
                throw new AppError_1.AppError('Você atingiu o limite máximo de 500 conexões do WhatsApp.', 403);
            }
            const instanceName = name || `Dispositivo ${currentCount + 1}`;
            const newInstance = await prismaClient_1.default.whatsAppInstance.create({
                data: {
                    userId,
                    name: instanceName,
                    status: 'DISCONNECTED'
                }
            });
            // Initialize the live instance
            WhatsAppInstanceManager_1.default.addInstance(newInstance.id, userId);
            ApiResponse_1.ApiResponse.success(res, newInstance, 'Nova instância WhatsApp criada.', 201);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * DELETE /api/whatsapp/instances/:id
     * Removes a WhatsApp instance, logs it out, and deletes the DB record.
     */
    async deleteInstance(req, res, next) {
        try {
            const userId = req.user.userId;
            const instanceId = parseInt(req.params.id, 10);
            const instance = await prismaClient_1.default.whatsAppInstance.findFirst({
                where: { id: instanceId, userId }
            });
            if (!instance) {
                throw new AppError_1.AppError('Instância não encontrada.', 404);
            }
            // Remove live instance (triggers logout and session wipe)
            await WhatsAppInstanceManager_1.default.removeInstance(instanceId);
            // Delete DB record
            await prismaClient_1.default.whatsAppInstance.delete({
                where: { id: instanceId }
            });
            ApiResponse_1.ApiResponse.success(res, null, 'Instância removida com sucesso.');
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/whatsapp/instances/:id/stream
     * Opens a Server-Sent Events (SSE) stream for a specific instance.
     */
    streamQr(req, res) {
        const userId = req.user?.userId;
        const instanceId = parseInt(req.params.id, 10);
        if (!userId || isNaN(instanceId)) {
            res.status(400).end();
            return;
        }
        const liveInstance = WhatsAppInstanceManager_1.default.getInstance(instanceId);
        if (!liveInstance || liveInstance.getUserId() !== userId) {
            res.status(404).json({ message: 'Instance not found or not active.' });
            return;
        }
        // ── Set SSE headers ───────────────────────────────────────────────────
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
        res.flushHeaders();
        logger_1.default.info(`[whatsapp-sse]: Client connected for instance ${instanceId} from ${req.ip}`);
        // ── Helper to push typed SSE events ──────────────────────────────────
        const pushEvent = (event, data = null) => {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
        };
        // ── Send the current status immediately ───────────────────────────────
        const current = liveInstance.getStatus();
        if (current.qrCode) {
            pushEvent('qr', { qrCode: current.qrCode });
        }
        else {
            pushEvent(current.state === 'open' ? 'connected' : 'disconnected', { state: current.state });
        }
        // ── Register event handlers ───────────────────────────────────────────
        const onQr = (qrCode) => pushEvent('qr', { qrCode });
        const onOpen = () => pushEvent('connected', null);
        const onClose = (reason) => pushEvent('disconnected', { reason: reason ?? null });
        const onQrTimeout = () => pushEvent('qr:timeout', null);
        liveInstance.on('wa:qr', onQr);
        liveInstance.on('wa:open', onOpen);
        liveInstance.on('wa:close', onClose);
        liveInstance.on('wa:qr:timeout', onQrTimeout);
        // ── Heartbeat — keeps connection alive through proxies ────────────────
        const heartbeat = setInterval(() => {
            pushEvent('heartbeat', { ts: new Date().toISOString() });
        }, SSE_HEARTBEAT_MS);
        // ── Cleanup when the client disconnects ───────────────────────────────
        req.on('close', () => {
            logger_1.default.info(`[whatsapp-sse]: Client disconnected for instance ${instanceId}`);
            clearInterval(heartbeat);
            liveInstance.off('wa:qr', onQr);
            liveInstance.off('wa:open', onOpen);
            liveInstance.off('wa:close', onClose);
            liveInstance.off('wa:qr:timeout', onQrTimeout);
        });
    }
    /**
     * GET /api/whatsapp/instances/:id/messages/stream
     * Opens an SSE stream to receive real-time messages from this instance.
     */
    streamMessages(req, res) {
        const userId = req.user?.userId;
        const instanceId = parseInt(req.params.id, 10);
        if (!userId || isNaN(instanceId)) {
            res.status(400).end();
            return;
        }
        const liveInstance = WhatsAppInstanceManager_1.default.getInstance(instanceId);
        if (!liveInstance || liveInstance.getUserId() !== userId) {
            res.status(404).json({ message: 'Instance not found or not active.' });
            return;
        }
        // ── Set SSE headers ───────────────────────────────────────────────────
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        logger_1.default.info(`[whatsapp-messages-sse]: Client connected for instance ${instanceId}`);
        // Helper to push typed SSE events
        const pushEvent = (event, data = null) => {
            res.write(`event: ${event}\n`);
            res.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
        };
        // Confirm connection immediately
        pushEvent('connected', { instanceId, message: 'Listening for incoming messages...' });
        // Handle incoming messages
        const onMessage = (payload) => {
            pushEvent('message', payload);
        };
        liveInstance.on('wa:message', onMessage);
        // Heartbeat
        const heartbeat = setInterval(() => {
            pushEvent('heartbeat', { ts: new Date().toISOString() });
        }, SSE_HEARTBEAT_MS);
        // Cleanup on close
        req.on('close', () => {
            logger_1.default.info(`[whatsapp-messages-sse]: Client disconnected for instance ${instanceId}`);
            clearInterval(heartbeat);
            liveInstance.off('wa:message', onMessage);
        });
    }
    /**
     * POST /api/whatsapp/instances/:id/test-message
     */
    async sendTestMessage(req, res, next) {
        try {
            const userId = req.user.userId;
            const instanceId = parseInt(req.params.id, 10);
            const { phoneNumber, message } = req.body;
            if (!phoneNumber || !message) {
                throw new AppError_1.AppError('phoneNumber and message are required in the body.', 400);
            }
            const liveInstance = WhatsAppInstanceManager_1.default.getInstance(instanceId);
            if (!liveInstance || liveInstance.getUserId() !== userId) {
                throw new AppError_1.AppError('Instância não ativa ou não autorizada.', 404);
            }
            await liveInstance.sendMessage(phoneNumber, message);
            ApiResponse_1.ApiResponse.success(res, null, 'Mensagem de teste enviada.');
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/whatsapp/instances/:id/restart
     */
    async restart(req, res, next) {
        try {
            const userId = req.user.userId;
            const instanceId = parseInt(req.params.id, 10);
            const liveInstance = WhatsAppInstanceManager_1.default.getInstance(instanceId);
            if (!liveInstance || liveInstance.getUserId() !== userId) {
                throw new AppError_1.AppError('Instância não ativa.', 404);
            }
            await liveInstance.restart();
            ApiResponse_1.ApiResponse.success(res, null, 'Sessão reiniciada.');
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/whatsapp/instances/:id/logout
     */
    async logout(req, res, next) {
        try {
            const userId = req.user.userId;
            const instanceId = parseInt(req.params.id, 10);
            const liveInstance = WhatsAppInstanceManager_1.default.getInstance(instanceId);
            if (!liveInstance || liveInstance.getUserId() !== userId) {
                throw new AppError_1.AppError('Instância não ativa.', 404);
            }
            await liveInstance.logout();
            ApiResponse_1.ApiResponse.success(res, null, 'WhatsApp desconectado.');
        }
        catch (err) {
            next(err);
        }
    }
}
exports.WhatsAppController = WhatsAppController;
exports.default = new WhatsAppController();
