"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const events_1 = require("events");
const whatsapp_web_js_1 = require("whatsapp-web.js");
const qrcode_1 = __importDefault(require("qrcode"));
const boom_1 = require("@hapi/boom");
const prismaClient_1 = __importDefault(require("../models/prismaClient"));
const logger_1 = __importDefault(require("../utils/logger"));
const whatsapp_types_1 = require("../types/whatsapp.types");
const phoneUtils_1 = require("../utils/phoneUtils");
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const QR_TIMEOUT_MS = 60_000;
class WhatsAppService extends events_1.EventEmitter {
    client = null;
    qrTimeoutRef = null;
    reconnectTimeoutRef = null;
    isManualOperation = false;
    status = {
        state: whatsapp_types_1.WaConnectionState.CLOSE,
        lastUpdated: new Date(),
    };
    healthScore = 100;
    instanceId;
    userId;
    constructor(instanceId, userId) {
        super();
        this.instanceId = instanceId;
        this.userId = userId;
        this.setMaxListeners(50);
    }
    getInstanceId() {
        return this.instanceId;
    }
    getUserId() {
        return this.userId;
    }
    async initialize() {
        const instanceData = await prismaClient_1.default.whatsAppInstance.findUnique({
            where: { id: this.instanceId }
        });
        if (instanceData?.healthScore !== undefined) {
            this.healthScore = instanceData.healthScore;
        }
        const puppeteerArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ];
        let proxyUrlObj = null;
        if (instanceData?.proxyUrl) {
            try {
                proxyUrlObj = new URL(instanceData.proxyUrl);
                puppeteerArgs.push(`--proxy-server=${proxyUrlObj.protocol}//${proxyUrlObj.hostname}:${proxyUrlObj.port}`);
                logger_1.default.info(`[whatsapp-${this.instanceId}]: Proxy Agent configured.`);
            }
            catch (err) {
                logger_1.default.error(`[whatsapp-${this.instanceId}]: Invalid proxy URL: ${instanceData.proxyUrl}`);
            }
        }
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({
                clientId: `instance_${this.instanceId}`,
                dataPath: path_1.default.resolve(process.cwd(), 'sessions')
            }),
            puppeteer: {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                headless: true,
                args: puppeteerArgs
            }
        });
        this._registerEventListeners();
        logger_1.default.info(`[whatsapp-${this.instanceId}]: Initializing whatsapp-web.js client...`);
        try {
            await this.client.initialize();
            // Handle proxy auth if needed
            if (proxyUrlObj && proxyUrlObj.username && proxyUrlObj.password && this.client.pupPage) {
                await this.client.pupPage.authenticate({
                    username: proxyUrlObj.username,
                    password: proxyUrlObj.password
                });
            }
        }
        catch (e) {
            logger_1.default.error(`[whatsapp-${this.instanceId}]: Failed to initialize client: ${e}`);
        }
    }
    getStatus() {
        return { ...this.status };
    }
    getClient() {
        return this.client;
    }
    async sendMessage(phoneNumber, text, delayMs = 1500, imagePath) {
        if (!this.client || this.status.state !== whatsapp_types_1.WaConnectionState.OPEN) {
            throw new boom_1.Boom('WhatsApp is not connected.', { statusCode: 503 });
        }
        const sanitized = (0, phoneUtils_1.sanitizePhoneNumber)(phoneNumber);
        let jid = sanitized.includes('@c.us') ? sanitized : `${sanitized}@c.us`;
        try {
            const isRegistered = await this.client.isRegisteredUser(jid);
            if (!isRegistered) {
                logger_1.default.warn(`[whatsapp-${this.instanceId}]: Number ${jid} is not registered on WhatsApp.`);
            }
        }
        catch (e) { }
        const chat = await this.client.getChatById(jid);
        await chat.sendStateTyping();
        if (delayMs > 0) {
            await new Promise(r => setTimeout(r, delayMs));
        }
        await chat.clearState();
        let sentMsg;
        if (imagePath && fs_1.default.existsSync(imagePath)) {
            const media = whatsapp_web_js_1.MessageMedia.fromFilePath(imagePath);
            sentMsg = await this.client.sendMessage(jid, media, { caption: text });
        }
        else {
            sentMsg = await this.client.sendMessage(jid, text);
        }
        logger_1.default.info(`[whatsapp]: Message sent successfully to ${jid}`);
        return sentMsg.id.id || '';
    }
    async sendMedia(phoneNumber, mediaPath, mimeType, caption = '', originalName = '') {
        if (!this.client || this.status.state !== whatsapp_types_1.WaConnectionState.OPEN) {
            throw new boom_1.Boom('WhatsApp is not connected.', { statusCode: 503 });
        }
        const sanitized = (0, phoneUtils_1.sanitizePhoneNumber)(phoneNumber);
        let jid = sanitized.includes('@c.us') ? sanitized : `${sanitized}@c.us`;
        const chat = await this.client.getChatById(jid);
        await chat.sendStateTyping();
        await new Promise(r => setTimeout(r, 1500));
        await chat.clearState();
        const media = whatsapp_web_js_1.MessageMedia.fromFilePath(mediaPath);
        // Explicitly set original name to force document mode for non-media types
        if (originalName) {
            media.filename = originalName;
        }
        const sentMsg = await this.client.sendMessage(jid, media, { caption });
        logger_1.default.info(`[whatsapp]: Media sent successfully to ${jid}`);
        return sentMsg.id.id || '';
    }
    async logout() {
        logger_1.default.info(`[whatsapp-${this.instanceId}]: Manual logout requested by user.`);
        this.isManualOperation = true;
        try {
            if (this.client) {
                await Promise.race([
                    this.client.logout().catch(() => { }),
                    new Promise(resolve => setTimeout(resolve, 3000))
                ]);
            }
            this._closeClient();
            this._updateStatus(whatsapp_types_1.WaConnectionState.CLOSE);
            this.emit('wa:close');
        }
        catch (err) {
            logger_1.default.error(`[whatsapp-${this.instanceId}]: Error during logout: ${err}`);
        }
        finally {
            this.isManualOperation = false;
        }
    }
    async disconnect() {
        logger_1.default.info(`[whatsapp-${this.instanceId}]: Manual disconnect (pause) requested by user.`);
        this.isManualOperation = true;
        try {
            this._closeClient();
            this._updateStatus(whatsapp_types_1.WaConnectionState.CLOSE);
            this.emit('wa:close');
        }
        catch (err) {
            logger_1.default.error(`[whatsapp-${this.instanceId}]: Error during disconnect: ${err}`);
        }
        finally {
            this.isManualOperation = false;
        }
    }
    async restart() {
        logger_1.default.info(`[whatsapp-${this.instanceId}]: Manual restart requested by user.`);
        this.isManualOperation = true;
        try {
            if (this.client) {
                try {
                    await this.client.destroy();
                }
                catch (e) { }
            }
            this._closeClient();
            this._updateStatus(whatsapp_types_1.WaConnectionState.CLOSE);
            await this.initialize();
        }
        catch (err) {
            logger_1.default.error(`[whatsapp-${this.instanceId}]: Error during restart: ${err}`);
        }
        finally {
            this.isManualOperation = false;
        }
    }
    _registerEventListeners() {
        if (!this.client)
            return;
        this.client.on('qr', async (qr) => {
            this._clearQrTimeout();
            logger_1.default.info(`[whatsapp-${this.instanceId}]: New QR Code generated. Waiting for scan...`);
            let qrBase64;
            try {
                qrBase64 = await qrcode_1.default.toDataURL(qr);
            }
            catch {
                logger_1.default.warn(`[whatsapp-${this.instanceId}]: QR encoding failed.`);
                qrBase64 = '';
            }
            this._updateStatus(whatsapp_types_1.WaConnectionState.CONNECTING, qrBase64);
            this.emit('wa:qr', qrBase64);
            this.qrTimeoutRef = setTimeout(() => {
                logger_1.default.warn(`[whatsapp-${this.instanceId}]: QR Code expired. Restarting connection...`);
                this.emit('wa:qr:timeout');
                this.restart().catch(() => { });
            }, QR_TIMEOUT_MS);
        });
        this.client.on('ready', () => {
            this._clearQrTimeout();
            logger_1.default.info(`[whatsapp-${this.instanceId}]: Connection established!`);
            this._updateStatus(whatsapp_types_1.WaConnectionState.OPEN);
            this.emit('wa:open');
        });
        this.client.on('disconnected', (reason) => {
            this._clearQrTimeout();
            logger_1.default.warn(`[whatsapp-${this.instanceId}]: Client disconnected. Reason: ${reason}`);
            this._updateStatus(whatsapp_types_1.WaConnectionState.CLOSE);
            this.emit('wa:close');
            if (!this.isManualOperation) {
                if (this.reconnectTimeoutRef) {
                    clearTimeout(this.reconnectTimeoutRef);
                }
                this.reconnectTimeoutRef = setTimeout(() => {
                    this.reconnectTimeoutRef = null;
                    this.initialize().catch(() => { });
                }, 5_000);
            }
        });
        this.client.on('message_ack', (msg, ack) => {
            // ack: 1=Send, 2=Delivered, 3=Read
            const messageId = msg.id.id;
            if (ack === 2) {
                this.emit('message:status', { messageId, status: 'delivered' });
            }
            else if (ack === 3) {
                this.emit('message:status', { messageId, status: 'read' });
            }
        });
        this.client.on('message', async (msg) => {
            const fromNumber = msg.from.split('@')[0];
            const messageId = msg.id.id;
            const timestamp = msg.timestamp * 1000;
            let text = msg.body || '';
            let mediaUrl;
            let mediaType;
            if (msg.hasMedia) {
                try {
                    const media = await msg.downloadMedia();
                    if (media) {
                        mediaType = media.mimetype;
                        const ext = mediaType.split('/')[1]?.split(';')[0] || 'bin';
                        const fileName = `${Date.now()}-${messageId}.${ext}`;
                        const uploadPath = path_1.default.resolve(process.cwd(), 'uploads', fileName);
                        if (!fs_1.default.existsSync(path_1.default.resolve(process.cwd(), 'uploads'))) {
                            fs_1.default.mkdirSync(path_1.default.resolve(process.cwd(), 'uploads'), { recursive: true });
                        }
                        fs_1.default.writeFileSync(uploadPath, Buffer.from(media.data, 'base64'));
                        mediaUrl = `/uploads/${fileName}`;
                    }
                }
                catch (err) {
                    logger_1.default.error(`[whatsapp-${this.instanceId}]: Failed to download incoming media: ${err}`);
                }
            }
            logger_1.default.info(`[whatsapp-${this.instanceId}]: Received message from ${fromNumber}`);
            this.emit('wa:message', {
                instanceId: this.instanceId,
                messageId,
                fromNumber,
                text,
                timestamp,
                mediaUrl,
                mediaType
            });
        });
    }
    _updateStatus(state, qrCode) {
        this.status = {
            state,
            qrCode: state === whatsapp_types_1.WaConnectionState.OPEN ? undefined : qrCode,
            lastUpdated: new Date(),
        };
    }
    _clearQrTimeout() {
        if (this.qrTimeoutRef) {
            clearTimeout(this.qrTimeoutRef);
            this.qrTimeoutRef = null;
        }
    }
    getHealthScore() {
        return this.healthScore;
    }
    async setHealthScore(score) {
        this.healthScore = Math.max(0, Math.min(100, score));
        this.emit('wa:health', this.healthScore);
        try {
            await prismaClient_1.default.whatsAppInstance.update({
                where: { id: this.instanceId },
                data: { healthScore: this.healthScore }
            });
        }
        catch (e) {
            logger_1.default.error(`[whatsapp-${this.instanceId}]: Failed to update health score: ${e}`);
        }
    }
    async deductHealth(points) {
        await this.setHealthScore(this.healthScore - points);
    }
    _closeClient() {
        if (this.reconnectTimeoutRef) {
            clearTimeout(this.reconnectTimeoutRef);
            this.reconnectTimeoutRef = null;
        }
        if (this.client) {
            try {
                this.client.destroy();
            }
            catch (e) { }
            this.client = null;
        }
    }
}
exports.WhatsAppService = WhatsAppService;
