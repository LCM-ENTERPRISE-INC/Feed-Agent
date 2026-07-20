"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const events_1 = require("events");
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const boom_1 = require("@hapi/boom");
const qrcode_1 = __importDefault(require("qrcode"));
const logger_1 = __importDefault(require("../utils/logger"));
const whatsapp_types_1 = require("../types/whatsapp.types");
const phoneUtils_1 = require("../utils/phoneUtils");
const baileys_2 = require("@whiskeysockets/baileys");
// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const QR_TIMEOUT_MS = 60_000; // 60 seconds before a new QR cycle is triggered
// ─────────────────────────────────────────────────────────────────────────────
// WhatsAppService — Singleton
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Manages the lifecycle of a single Baileys WebSocket connection.
 * Extends EventEmitter to broadcast connection events to SSE listeners.
 *
 * Usage:
 *   await whatsAppService.initialize();
 *   whatsAppService.on('wa:qr', (qrBase64) => { ... });
 */
class WhatsAppService extends events_1.EventEmitter {
    socket = null;
    qrTimeoutRef = null;
    reconnectTimeoutRef = null;
    isManualOperation = false; // Prevents auto-reconnect during manual restart/logout
    status = {
        state: whatsapp_types_1.WaConnectionState.CLOSE,
        lastUpdated: new Date(),
    };
    instanceId;
    userId;
    sessionDir;
    constructor(instanceId, userId) {
        super();
        this.instanceId = instanceId;
        this.userId = userId;
        this.sessionDir = path_1.default.resolve(process.cwd(), `sessions/instance_${instanceId}`);
        // Avoid Node.js MaxListenersExceededWarning for many SSE clients
        this.setMaxListeners(50);
    }
    getInstanceId() {
        return this.instanceId;
    }
    getUserId() {
        return this.userId;
    }
    // ─── Public API ───────────────────────────────────────────────────────────
    /**
     * Initializes (or re-initializes) the Baileys WebSocket connection.
     * Loads existing session from disk. If no session exists, a QR Code is
     * generated, emitted via `wa:qr` event, and available in `getStatus()`.
     */
    async initialize() {
        if (!fs_1.default.existsSync(this.sessionDir)) {
            fs_1.default.mkdirSync(this.sessionDir, { recursive: true });
        }
        const { version } = await (0, baileys_1.fetchLatestBaileysVersion)();
        logger_1.default.info(`[whatsapp-${this.instanceId}]: Using Baileys v${version.join('.')}`);
        const { state: authState, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(this.sessionDir);
        const dummyLogger = {
            level: 'silent',
            child: () => dummyLogger,
            info: () => { },
            debug: () => { },
            warn: () => { },
            error: () => { },
            trace: () => { },
        };
        this.socket = (0, baileys_1.default)({
            version,
            auth: authState,
            logger: dummyLogger,
            printQRInTerminal: false,
        });
        this._registerEventListeners(saveCreds);
        logger_1.default.info('[whatsapp]: WhatsApp socket initialized.');
    }
    /**
     * Returns an immutable snapshot of the current connection status.
     * `status.qrCode` is populated only while awaiting a QR scan.
     */
    getStatus() {
        return { ...this.status };
    }
    /**
     * Returns the raw Baileys socket, or null if not initialized.
     * Used by message-sending methods in Sprint 15.
     */
    getSocket() {
        return this.socket;
    }
    /**
     * Sends a text message to a specific phone number.
     * Handles sanitization, JID formatting, artificial delays, and simulated typing.
     *
     * @param phoneNumber - The recipient's raw or sanitized phone number.
     * @param text        - The text message content to send.
     * @param delayMs     - Optional artificial delay before sending (default: 1500ms).
     */
    async sendMessage(phoneNumber, text, delayMs = 1500, imagePath) {
        if (!this.socket || this.status.state !== whatsapp_types_1.WaConnectionState.OPEN) {
            throw new boom_1.Boom('WhatsApp is not connected.', { statusCode: 503 });
        }
        // 1. Sanitize and format the number to Baileys JID format
        const sanitized = (0, phoneUtils_1.sanitizePhoneNumber)(phoneNumber);
        let jid = (0, phoneUtils_1.toWhatsAppJid)(sanitized);
        // 1.5. Resolve the actual registered JID on WhatsApp (fixes Brazilian 9th digit issue)
        try {
            const results = await this.socket.onWhatsApp(sanitized);
            if (results && results.length > 0) {
                const result = results[0];
                if (result.exists) {
                    jid = result.jid;
                }
            }
        }
        catch (err) {
            logger_1.default.warn(`[whatsapp]: Could not resolve onWhatsApp for ${sanitized}: ${err}`);
        }
        // 2. Simulate typing presence to make it feel human
        await this.socket.presenceSubscribe(jid);
        await (0, baileys_2.delay)(500);
        await this.socket.sendPresenceUpdate('composing', jid);
        // 3. Artificial delay (configurable, helps prevent spam detection)
        await (0, baileys_2.delay)(delayMs);
        // 4. Send the actual message (with optional image) and clear typing status
        await this.socket.sendPresenceUpdate('paused', jid);
        let sentMsg;
        if (imagePath && fs_1.default.existsSync(imagePath)) {
            sentMsg = await this.socket.sendMessage(jid, {
                image: fs_1.default.readFileSync(imagePath),
                caption: text
            });
        }
        else {
            sentMsg = await this.socket.sendMessage(jid, { text });
        }
        logger_1.default.info(`[whatsapp]: Message sent successfully to ${jid}`);
        return sentMsg?.key?.id || '';
    }
    /**
     * Sends a media file to a specific phone number.
     */
    async sendMedia(phoneNumber, mediaPath, mimeType, caption = '', originalName = '') {
        if (!this.socket || this.status.state !== whatsapp_types_1.WaConnectionState.OPEN) {
            throw new boom_1.Boom('WhatsApp is not connected.', { statusCode: 503 });
        }
        const sanitized = (0, phoneUtils_1.sanitizePhoneNumber)(phoneNumber);
        let jid = (0, phoneUtils_1.toWhatsAppJid)(sanitized);
        try {
            const results = await this.socket.onWhatsApp(sanitized);
            if (results && results.length > 0) {
                if (results[0].exists)
                    jid = results[0].jid;
            }
        }
        catch (err) { }
        await this.socket.presenceSubscribe(jid);
        await (0, baileys_2.delay)(500);
        await this.socket.sendPresenceUpdate('composing', jid);
        await (0, baileys_2.delay)(1000);
        await this.socket.sendPresenceUpdate('paused', jid);
        const buffer = fs_1.default.readFileSync(mediaPath);
        let sentMsg;
        if (mimeType.startsWith('image/')) {
            sentMsg = await this.socket.sendMessage(jid, { image: buffer, caption });
        }
        else if (mimeType.startsWith('video/')) {
            sentMsg = await this.socket.sendMessage(jid, { video: buffer, caption });
        }
        else if (mimeType.startsWith('audio/')) {
            sentMsg = await this.socket.sendMessage(jid, { audio: buffer, mimetype: mimeType });
        }
        else {
            sentMsg = await this.socket.sendMessage(jid, { document: buffer, mimetype: mimeType, fileName: originalName, caption });
        }
        logger_1.default.info(`[whatsapp]: Media sent successfully to ${jid}`);
        return sentMsg?.key?.id || '';
    }
    /**
     * Manually logs out from the current Baileys session and cleans up disk files.
     * Emits 'wa:close' to notify clients that the session was ended by the user.
     */
    async logout() {
        logger_1.default.info(`[whatsapp-${this.instanceId}]: Manual logout requested by user.`);
        this.isManualOperation = true;
        try {
            if (this.socket) {
                // Run logout with a 3-second timeout to prevent hanging the API if Baileys is stuck
                await Promise.race([
                    this.socket.logout('Manual logout requested via API').catch(() => { }),
                    new Promise(resolve => setTimeout(resolve, 3000))
                ]);
            }
            this._closeSocket();
            this._updateStatus(whatsapp_types_1.WaConnectionState.CLOSE);
            this._deleteSessionDir();
            this.emit('wa:close');
        }
        catch (err) {
            logger_1.default.error(`[whatsapp-${this.instanceId}]: Error during logout: ${err}`);
            this._deleteSessionDir();
        }
        finally {
            this.isManualOperation = false;
        }
    }
    /**
     * Pauses the current Baileys session without deleting the credentials from disk.
     * Emits 'wa:close' to notify clients that the session was ended temporarily.
     * Can be reconnected later automatically without scanning a QR code.
     */
    async disconnect() {
        logger_1.default.info(`[whatsapp-${this.instanceId}]: Manual disconnect (pause) requested by user.`);
        this.isManualOperation = true;
        try {
            this._closeSocket();
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
    /**
     * Restarts the current session and clears files to force a new QR generation.
     */
    async restart() {
        logger_1.default.info(`[whatsapp-${this.instanceId}]: Manual restart requested by user.`);
        this.isManualOperation = true;
        try {
            this._closeSocket();
            this._updateStatus(whatsapp_types_1.WaConnectionState.CLOSE);
            this._deleteSessionDir();
            await this.initialize();
        }
        catch (err) {
            logger_1.default.error(`[whatsapp-${this.instanceId}]: Error during restart: ${err}`);
        }
        finally {
            this.isManualOperation = false;
        }
    }
    // ─── Private Helpers ──────────────────────────────────────────────────────
    /**
     * Registers all Baileys event listeners on the active socket instance.
     *
     * @param saveCreds - Persistence callback from `useMultiFileAuthState`.
     */
    _registerEventListeners(saveCreds) {
        if (!this.socket)
            return;
        // Persist credentials on every update
        this.socket.ev.on('creds.update', async () => {
            await saveCreds();
            logger_1.default.info('[whatsapp]: Credentials saved to disk.');
        });
        // Handle all connection state transitions
        this.socket.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            // ── New QR Code — encode + emit + start expiry timer ───────────────
            if (qr) {
                this._clearQrTimeout();
                logger_1.default.info('[whatsapp]: New QR Code generated. Waiting for scan...');
                let qrBase64;
                try {
                    qrBase64 = await qrcode_1.default.toDataURL(qr);
                }
                catch {
                    logger_1.default.warn('[whatsapp]: QR encoding failed.');
                    qrBase64 = '';
                }
                this._updateStatus(whatsapp_types_1.WaConnectionState.CONNECTING, qrBase64);
                this.emit('wa:qr', qrBase64);
                // If not scanned within timeout, trigger a fresh cycle
                this.qrTimeoutRef = setTimeout(() => {
                    logger_1.default.warn('[whatsapp]: QR Code expired. Restarting connection...');
                    this.emit('wa:qr:timeout');
                    this._closeSocket();
                    this.initialize().catch(() => { });
                }, QR_TIMEOUT_MS);
            }
            // ── Connecting ──────────────────────────────────────────────────────
            if (connection === 'connecting') {
                logger_1.default.info('[whatsapp]: Connecting to WhatsApp...');
                this._updateStatus(whatsapp_types_1.WaConnectionState.CONNECTING);
            }
            // ── Open (authenticated) ────────────────────────────────────────────
            if (connection === 'open') {
                this._clearQrTimeout();
                logger_1.default.info('[whatsapp]: Connection established!');
                this._updateStatus(whatsapp_types_1.WaConnectionState.OPEN);
                this.emit('wa:open');
            }
            // ── Closed ─────────────────────────────────────────────────────────
            if (connection === 'close') {
                this._clearQrTimeout();
                const reason = lastDisconnect?.error?.output?.statusCode;
                const isLoggedOut = reason === baileys_1.DisconnectReason.loggedOut;
                const isBanned = reason === 403; // 403 Forbidden is typically returned for banned/blocked numbers
                const shouldReconnect = !isLoggedOut && !isBanned;
                this._updateStatus(whatsapp_types_1.WaConnectionState.CLOSE);
                if (isBanned) {
                    logger_1.default.error(`[whatsapp-${this.instanceId}]: 🚨 CRITICAL ALERT: WhatsApp account has been BANNED or FORBIDDEN (Code: 403).`);
                    this.emit('wa:close', reason);
                    this._deleteSessionDir();
                }
                else if (isLoggedOut) {
                    logger_1.default.warn(`[whatsapp-${this.instanceId}]: Logged out from device. Clearing session files...`);
                    this.emit('wa:close', reason);
                    this._deleteSessionDir();
                }
                else {
                    logger_1.default.warn(`[whatsapp-${this.instanceId}]: Connection closed. Reason code: ${reason}. ${this.isManualOperation ? 'Manual operation in progress, skipping auto-reconnect.' : 'Reconnecting in 5s...'}`);
                    this.emit('wa:close', reason);
                    // Don't auto-reconnect if this was triggered by a manual restart/logout
                    if (!this.isManualOperation) {
                        if (this.reconnectTimeoutRef) {
                            clearTimeout(this.reconnectTimeoutRef);
                        }
                        this.reconnectTimeoutRef = setTimeout(() => {
                            this.reconnectTimeoutRef = null;
                            this.initialize().catch(() => { });
                        }, 5_000);
                    }
                }
            }
        });
        // Handle message receipts (delivered / read)
        this.socket.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                if (update.update.status) {
                    const messageId = update.key.id;
                    const statusInt = update.update.status;
                    let strStatus = null;
                    // Baileys status codes: 3 = SERVER_ACK/DELIVERY_ACK, 4 = READ
                    if (statusInt === 3)
                        strStatus = 'delivered';
                    if (statusInt === 4)
                        strStatus = 'read';
                    if (messageId && strStatus) {
                        this.emit('message:status', { messageId, status: strStatus });
                    }
                }
            }
        });
        // Handle new incoming messages (for real-time chat)
        this.socket.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify')
                return; // Only process new messages
            for (const msg of m.messages) {
                if (msg.key.fromMe || !msg.message || !msg.key.remoteJid)
                    continue;
                if (msg.key.remoteJid === 'status@broadcast')
                    continue; // Ignore statuses
                const remoteJid = msg.key.remoteJid;
                const fromNumber = remoteJid.split('@')[0]; // Simple normalization to phone number
                const messageId = msg.key.id || '';
                let timestamp = Date.now();
                if (typeof msg.messageTimestamp === 'number') {
                    timestamp = msg.messageTimestamp * 1000;
                }
                else if (typeof msg.messageTimestamp === 'string') {
                    timestamp = parseInt(msg.messageTimestamp, 10) * 1000;
                }
                // Extract text (conversation for normal texts, extendedTextMessage for replies/links)
                let text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                let mediaUrl;
                let mediaType;
                const msgType = Object.keys(msg.message || {})[0];
                if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(msgType)) {
                    try {
                        const buffer = await (0, baileys_1.downloadMediaMessage)(msg, 'buffer', {}, {
                            logger: this.socket.logger,
                            reuploadRequest: this.socket.updateMediaMessage
                        });
                        const messageObj = msg.message[msgType];
                        mediaType = messageObj?.mimetype || 'application/octet-stream';
                        const ext = mediaType.split('/')[1]?.split(';')[0] || 'bin';
                        const fileName = `${Date.now()}-${messageId}.${ext}`;
                        const uploadPath = path_1.default.resolve(process.cwd(), 'uploads', fileName);
                        if (!fs_1.default.existsSync(path_1.default.resolve(process.cwd(), 'uploads'))) {
                            fs_1.default.mkdirSync(path_1.default.resolve(process.cwd(), 'uploads'), { recursive: true });
                        }
                        fs_1.default.writeFileSync(uploadPath, buffer);
                        mediaUrl = `/uploads/${fileName}`;
                        if (!text && messageObj?.caption) {
                            text = messageObj.caption;
                        }
                    }
                    catch (err) {
                        logger_1.default.error(`[whatsapp-${this.instanceId}]: Failed to download incoming media: ${err}`);
                    }
                }
                if (text || mediaUrl) {
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
                }
            }
        });
    }
    /**
     * Updates the internal status snapshot.
     * Clears `qrCode` once the state is OPEN to free memory.
     */
    _updateStatus(state, qrCode) {
        this.status = {
            state,
            qrCode: state === whatsapp_types_1.WaConnectionState.OPEN ? undefined : qrCode,
            lastUpdated: new Date(),
        };
    }
    /** Cancels any pending QR expiry timer. */
    _clearQrTimeout() {
        if (this.qrTimeoutRef) {
            clearTimeout(this.qrTimeoutRef);
            this.qrTimeoutRef = null;
        }
    }
    /** Destroys the active socket, triggering a 'close' event. */
    _closeSocket() {
        if (this.reconnectTimeoutRef) {
            clearTimeout(this.reconnectTimeoutRef);
            this.reconnectTimeoutRef = null;
        }
        if (this.socket) {
            this.socket.end(undefined);
            this.socket = null;
        }
    }
    /** Removes all session files, forcing a fresh QR scan on next initialize(). */
    _deleteSessionDir() {
        if (fs_1.default.existsSync(this.sessionDir)) {
            try {
                fs_1.default.rmSync(this.sessionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
                logger_1.default.info(`[whatsapp-${this.instanceId}]: Session directory cleared.`);
            }
            catch (err) {
                logger_1.default.error(`[whatsapp-${this.instanceId}]: Failed to clear session directory, trying to delete files individually: ${err}`);
                try {
                    const files = fs_1.default.readdirSync(this.sessionDir);
                    for (const file of files) {
                        try {
                            const filePath = path_1.default.join(this.sessionDir, file);
                            if (fs_1.default.lstatSync(filePath).isDirectory()) {
                                fs_1.default.rmSync(filePath, { recursive: true, force: true });
                            }
                            else {
                                fs_1.default.unlinkSync(filePath);
                            }
                        }
                        catch (fileErr) {
                            logger_1.default.warn(`[whatsapp-${this.instanceId}]: Could not delete file ${file}: ${fileErr}`);
                        }
                    }
                }
                catch (dirErr) {
                    logger_1.default.error(`[whatsapp-${this.instanceId}]: Error reading session directory: ${dirErr}`);
                }
            }
        }
    }
}
exports.WhatsAppService = WhatsAppService;
