import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import { WarmupStatusViewerService } from '../Warm-up/services/WarmupStatusViewerService';
import { WarmupGroupReaderService } from '../Warm-up/services/WarmupGroupReaderService';
import { WarmupIndividualReaderService } from '../Warm-up/services/WarmupIndividualReaderService';
import logger from '../utils/logger';
import { WaConnectionState, WaStatus } from '../types/whatsapp.types';
import { sanitizePhoneNumber, toWhatsAppJid } from '../utils/phoneUtils';
import { delay } from '@whiskeysockets/baileys';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const QR_TIMEOUT_MS  = 60_000; // 60 seconds before a new QR cycle is triggered

// ─────────────────────────────────────────────────────────────────────────────
// Event Map
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Internal event bus contract for WhatsAppService.
 *
 * Events:
 *  - `wa:qr`           — emitted whenever a new QR Code is ready (payload: Base64 PNG string)
 *  - `wa:open`         — emitted when the connection is fully established
 *  - `wa:close`        — emitted when the connection drops (payload: reason code | undefined)
 *  - `wa:qr:timeout`   — emitted when the QR Code expires without being scanned
 */
export declare interface WhatsAppService {
  emit(event: 'wa:qr',         qrBase64: string):    boolean;
  emit(event: 'wa:open'):                            boolean;
  emit(event: 'wa:close',      reason?: number):     boolean;
  emit(event: 'wa:qr:timeout'):                      boolean;
  emit(event: 'message:status', payload: { messageId: string, status: 'delivered' | 'read' }): boolean;
  emit(event: 'wa:message', payload: { instanceId: number, messageId: string, fromNumber: string, text: string, timestamp: number, mediaUrl?: string, mediaType?: string }): boolean;

  on(event: 'wa:qr',         listener: (qrBase64: string)  => void): this;
  on(event: 'wa:open',       listener: ()                  => void): this;
  on(event: 'wa:close',      listener: (reason?: number)   => void): this;
  on(event: 'wa:qr:timeout', listener: ()                  => void): this;
  on(event: 'message:status', listener: (payload: { messageId: string, status: 'delivered' | 'read' }) => void): this;
  on(event: 'wa:message',    listener: (payload: { instanceId: number, messageId: string, fromNumber: string, text: string, timestamp: number, mediaUrl?: string, mediaType?: string }) => void): this;
}

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
export class WhatsAppService extends EventEmitter {
  private socket:        WASocket | null = null;
  private qrTimeoutRef:  ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  private isManualOperation: boolean = false; // Prevents auto-reconnect during manual restart/logout
  private status:        WaStatus = {
    state:       WaConnectionState.CLOSE,
    lastUpdated: new Date(),
  };

  private instanceId: number;
  private userId: number;
  private sessionDir: string;

  constructor(instanceId: number, userId: number) {
    super();
    this.instanceId = instanceId;
    this.userId = userId;
    this.sessionDir = path.resolve(process.cwd(), `sessions/instance_${instanceId}`);
    // Avoid Node.js MaxListenersExceededWarning for many SSE clients
    this.setMaxListeners(50);
  }

  getInstanceId(): number {
    return this.instanceId;
  }

  getUserId(): number {
    return this.userId;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Initializes (or re-initializes) the Baileys WebSocket connection.
   * Loads existing session from disk. If no session exists, a QR Code is
   * generated, emitted via `wa:qr` event, and available in `getStatus()`.
   */
  async initialize(): Promise<void> {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    const { version } = await fetchLatestBaileysVersion();
    logger.info(`[whatsapp-${this.instanceId}]: Using Baileys v${version.join('.')}`);

    const { state: authState, saveCreds } = await useMultiFileAuthState(this.sessionDir);

    const dummyLogger = {
      level: 'silent',
      child: () => dummyLogger,
      info: () => {},
      debug: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {},
    };

    this.socket = makeWASocket({
      version,
      auth:              authState,
      logger:            dummyLogger as any,
      printQRInTerminal: false,
    });

    this._registerEventListeners(saveCreds);
    logger.info('[whatsapp]: WhatsApp socket initialized.');
  }

  /**
   * Returns an immutable snapshot of the current connection status.
   * `status.qrCode` is populated only while awaiting a QR scan.
   */
  getStatus(): WaStatus {
    return { ...this.status };
  }

  /**
   * Returns the raw Baileys socket, or null if not initialized.
   * Used by message-sending methods in Sprint 15.
   */
  getSocket(): WASocket | null {
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
  async sendMessage(phoneNumber: string, text: string, delayMs = 1500, imagePath?: string): Promise<string> {
    if (!this.socket || this.status.state !== WaConnectionState.OPEN) {
      throw new Boom('WhatsApp is not connected.', { statusCode: 503 });
    }

    // 1. Sanitize and format the number to Baileys JID format
    const sanitized = sanitizePhoneNumber(phoneNumber);
    let jid = toWhatsAppJid(sanitized);

    // 1.5. Resolve the actual registered JID on WhatsApp (fixes Brazilian 9th digit issue)
    try {
      const results = await this.socket.onWhatsApp(sanitized);
      if (results && results.length > 0) {
        const result = results[0];
        if (result.exists) {
          jid = result.jid;
        }
      }
    } catch (err) {
      logger.warn(`[whatsapp]: Could not resolve onWhatsApp for ${sanitized}: ${err}`);
    }

    // 2. Simulate typing presence to make it feel human
    await this.socket.presenceSubscribe(jid);
    await delay(500);
    await this.socket.sendPresenceUpdate('composing', jid);

    // 3. Artificial delay (configurable, helps prevent spam detection)
    await delay(delayMs);

    // 4. Send the actual message (with optional image) and clear typing status
    await this.socket.sendPresenceUpdate('paused', jid);
    
    let sentMsg;
    if (imagePath && fs.existsSync(imagePath)) {
      sentMsg = await this.socket.sendMessage(jid, { 
        image: fs.readFileSync(imagePath), 
        caption: text 
      });
    } else {
      sentMsg = await this.socket.sendMessage(jid, { text });
    }

    logger.info(`[whatsapp]: Message sent successfully to ${jid}`);
    return sentMsg?.key?.id || '';
  }

  /**
   * Sends a media file to a specific phone number.
   */
  async sendMedia(phoneNumber: string, mediaPath: string, mimeType: string, caption = '', originalName = ''): Promise<string> {
    if (!this.socket || this.status.state !== WaConnectionState.OPEN) {
      throw new Boom('WhatsApp is not connected.', { statusCode: 503 });
    }

    const sanitized = sanitizePhoneNumber(phoneNumber);
    let jid = toWhatsAppJid(sanitized);

    try {
      const results = await this.socket.onWhatsApp(sanitized);
      if (results && results.length > 0) {
        if (results[0].exists) jid = results[0].jid;
      }
    } catch (err) {}

    await this.socket.presenceSubscribe(jid);
    await delay(500);
    await this.socket.sendPresenceUpdate('composing', jid);
    await delay(1000);
    await this.socket.sendPresenceUpdate('paused', jid);

    const buffer = fs.readFileSync(mediaPath);
    let sentMsg;
    
    if (mimeType.startsWith('image/')) {
      sentMsg = await this.socket.sendMessage(jid, { image: buffer, caption });
    } else if (mimeType.startsWith('video/')) {
      sentMsg = await this.socket.sendMessage(jid, { video: buffer, caption });
    } else if (mimeType.startsWith('audio/')) {
      sentMsg = await this.socket.sendMessage(jid, { audio: buffer, mimetype: mimeType });
    } else {
      sentMsg = await this.socket.sendMessage(jid, { document: buffer, mimetype: mimeType, fileName: originalName, caption });
    }

    logger.info(`[whatsapp]: Media sent successfully to ${jid}`);
    return sentMsg?.key?.id || '';
  }

  /**
   * Manually logs out from the current Baileys session and cleans up disk files.
   * Emits 'wa:close' to notify clients that the session was ended by the user.
   */
  public async logout(): Promise<void> {
    logger.info(`[whatsapp-${this.instanceId}]: Manual logout requested by user.`);
    this.isManualOperation = true;
    try {
      if (this.socket) {
        // Run logout with a 3-second timeout to prevent hanging the API if Baileys is stuck
        await Promise.race([
          this.socket.logout('Manual logout requested via API').catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      }
      this._closeSocket();
      this._updateStatus(WaConnectionState.CLOSE);
      this._deleteSessionDir();
      this.emit('wa:close');
    } catch (err) {
      logger.error(`[whatsapp-${this.instanceId}]: Error during logout: ${err}`);
      this._deleteSessionDir();
    } finally {
      this.isManualOperation = false;
    }
  }

  /**
   * Pauses the current Baileys session without deleting the credentials from disk.
   * Emits 'wa:close' to notify clients that the session was ended temporarily.
   * Can be reconnected later automatically without scanning a QR code.
   */
  public async disconnect(): Promise<void> {
    logger.info(`[whatsapp-${this.instanceId}]: Manual disconnect (pause) requested by user.`);
    this.isManualOperation = true;
    try {
      this._closeSocket();
      this._updateStatus(WaConnectionState.CLOSE);
      this.emit('wa:close');
    } catch (err) {
      logger.error(`[whatsapp-${this.instanceId}]: Error during disconnect: ${err}`);
    } finally {
      this.isManualOperation = false;
    }
  }

  /**
   * Restarts the current session and clears files to force a new QR generation.
   */
  public async restart(): Promise<void> {
    logger.info(`[whatsapp-${this.instanceId}]: Manual restart requested by user.`);
    this.isManualOperation = true;
    try {
      this._closeSocket();
      this._updateStatus(WaConnectionState.CLOSE);
      this._deleteSessionDir();
      await this.initialize();
    } catch (err) {
      logger.error(`[whatsapp-${this.instanceId}]: Error during restart: ${err}`);
    } finally {
      this.isManualOperation = false;
    }
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /**
   * Registers all Baileys event listeners on the active socket instance.
   *
   * @param saveCreds - Persistence callback from `useMultiFileAuthState`.
   */
  private _registerEventListeners(saveCreds: () => Promise<void>): void {
    if (!this.socket) return;

    // Persist credentials on every update
    this.socket.ev.on('creds.update', async () => {
      await saveCreds();
      logger.info('[whatsapp]: Credentials saved to disk.');
    });

    // Handle all connection state transitions
    this.socket.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      // ── New QR Code — encode + emit + start expiry timer ───────────────
      if (qr) {
        this._clearQrTimeout();
        logger.info('[whatsapp]: New QR Code generated. Waiting for scan...');

        let qrBase64: string;
        try {
          qrBase64 = await QRCode.toDataURL(qr);
        } catch {
          logger.warn('[whatsapp]: QR encoding failed.');
          qrBase64 = '';
        }

        this._updateStatus(WaConnectionState.CONNECTING, qrBase64);
        this.emit('wa:qr', qrBase64);

        // If not scanned within timeout, trigger a fresh cycle
        this.qrTimeoutRef = setTimeout(() => {
          logger.warn('[whatsapp]: QR Code expired. Restarting connection...');
          this.emit('wa:qr:timeout');
          this._closeSocket();
          this.initialize().catch(() => {});
        }, QR_TIMEOUT_MS);
      }

      // ── Connecting ──────────────────────────────────────────────────────
      if (connection === 'connecting') {
        logger.info('[whatsapp]: Connecting to WhatsApp...');
        this._updateStatus(WaConnectionState.CONNECTING);
      }

      // ── Open (authenticated) ────────────────────────────────────────────
      if (connection === 'open') {
        this._clearQrTimeout();
        logger.info('[whatsapp]: Connection established!');
        this._updateStatus(WaConnectionState.OPEN);
        this.emit('wa:open');
      }

      // ── Closed ─────────────────────────────────────────────────────────
      if (connection === 'close') {
        this._clearQrTimeout();
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        
        const isLoggedOut = reason === DisconnectReason.loggedOut;
        const isBanned    = reason === 403; // 403 Forbidden is typically returned for banned/blocked numbers
        const shouldReconnect = !isLoggedOut && !isBanned;

        this._updateStatus(WaConnectionState.CLOSE);

        if (isBanned) {
          logger.error(`[whatsapp-${this.instanceId}]: 🚨 CRITICAL ALERT: WhatsApp account has been BANNED or FORBIDDEN (Code: 403).`);
          this.emit('wa:close', reason);
          this._deleteSessionDir();
        } else if (isLoggedOut) {
          logger.warn(`[whatsapp-${this.instanceId}]: Logged out from device. Clearing session files...`);
          this.emit('wa:close', reason);
          this._deleteSessionDir();
        } else {
          logger.warn(`[whatsapp-${this.instanceId}]: Connection closed. Reason code: ${reason}. ${this.isManualOperation ? 'Manual operation in progress, skipping auto-reconnect.' : 'Reconnecting in 5s...'}`);
          this.emit('wa:close', reason);

          // Don't auto-reconnect if this was triggered by a manual restart/logout
          if (!this.isManualOperation) {
            if (this.reconnectTimeoutRef) {
              clearTimeout(this.reconnectTimeoutRef);
            }
            this.reconnectTimeoutRef = setTimeout(() => {
              this.reconnectTimeoutRef = null;
              this.initialize().catch(() => {});
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
          
          let strStatus: 'delivered' | 'read' | null = null;
          // Baileys status codes: 3 = SERVER_ACK/DELIVERY_ACK, 4 = READ
          if (statusInt === 3) strStatus = 'delivered';
          if (statusInt === 4) strStatus = 'read';

          if (messageId && strStatus) {
            this.emit('message:status', { messageId, status: strStatus });
          }
        }
      }
    });

    // Handle new incoming messages (for real-time chat)
    this.socket.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return; // Only process new messages
      
      for (const msg of m.messages) {
        if (msg.key.fromMe || !msg.message || !msg.key.remoteJid) continue;
        
        // Pass status broadcasts to Warmup module instead of just ignoring them completely
        if (msg.key.remoteJid === 'status@broadcast') {
          await WarmupStatusViewerService.handleIncomingStatus(this.instanceId.toString(), msg, this.socket!);
          continue; 
        }

        // --- WARMUP INTERCEPTION: Individual DMs ---
        if (!msg.key.fromMe && !msg.key.remoteJid?.endsWith('@g.us')) {
          await WarmupIndividualReaderService.handleIncomingMessage(this.instanceId.toString(), msg, this.socket!);
        }
        
        const remoteJid = msg.key.remoteJid;
        const fromNumber = remoteJid.split('@')[0]; // Simple normalization to phone number
        
        // Pass group messages to Warmup module for passive viewing, but DO NOT stop processing
        if (remoteJid.endsWith('@g.us')) {
          await WarmupGroupReaderService.handleIncomingGroupMessage(this.instanceId.toString(), msg, this.socket!);
          // Notice: We don't 'continue;' here because actual CRM features might need the group message.
        }

        const messageId = msg.key.id || '';
        let timestamp = Date.now();
        if (typeof msg.messageTimestamp === 'number') {
          timestamp = msg.messageTimestamp * 1000;
        } else if (typeof msg.messageTimestamp === 'string') {
          timestamp = parseInt(msg.messageTimestamp, 10) * 1000;
        }

        // Extract text (conversation for normal texts, extendedTextMessage for replies/links)
        let text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        
        let mediaUrl;
        let mediaType;

        const msgType = Object.keys(msg.message || {})[0];
        
        if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(msgType)) {
          try {
            const buffer = await downloadMediaMessage(msg, 'buffer', { }, { 
              logger: this.socket!.logger as any,
              reuploadRequest: this.socket!.updateMediaMessage
            });
            
            const messageObj: any = msg.message[msgType as keyof typeof msg.message];
            mediaType = messageObj?.mimetype || 'application/octet-stream';
            
            const ext = mediaType.split('/')[1]?.split(';')[0] || 'bin';
            const fileName = `${Date.now()}-${messageId}.${ext}`;
            const uploadPath = path.resolve(process.cwd(), 'uploads', fileName);
            
            if (!fs.existsSync(path.resolve(process.cwd(), 'uploads'))) {
              fs.mkdirSync(path.resolve(process.cwd(), 'uploads'), { recursive: true });
            }
            fs.writeFileSync(uploadPath, buffer);
            
            mediaUrl = `/uploads/${fileName}`;
            if (!text && messageObj?.caption) {
              text = messageObj.caption;
            }
          } catch (err) {
            logger.error(`[whatsapp-${this.instanceId}]: Failed to download incoming media: ${err}`);
          }
        }

        if (text || mediaUrl) {
          logger.info(`[whatsapp-${this.instanceId}]: Received message from ${fromNumber}`);
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
  private _updateStatus(state: WaConnectionState, qrCode?: string): void {
    this.status = {
      state,
      qrCode:      state === WaConnectionState.OPEN ? undefined : qrCode,
      lastUpdated: new Date(),
    };
  }

  /** Cancels any pending QR expiry timer. */
  private _clearQrTimeout(): void {
    if (this.qrTimeoutRef) {
      clearTimeout(this.qrTimeoutRef);
      this.qrTimeoutRef = null;
    }
  }

  /** Destroys the active socket, triggering a 'close' event. */
  private _closeSocket(): void {
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
  private _deleteSessionDir(): void {
    if (fs.existsSync(this.sessionDir)) {
      try {
        fs.rmSync(this.sessionDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
        logger.info(`[whatsapp-${this.instanceId}]: Session directory cleared.`);
      } catch (err) {
        logger.error(`[whatsapp-${this.instanceId}]: Failed to clear session directory, trying to delete files individually: ${err}`);
        try {
          const files = fs.readdirSync(this.sessionDir);
          for (const file of files) {
            try {
              const filePath = path.join(this.sessionDir, file);
              if (fs.lstatSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
            } catch (fileErr) {
              logger.warn(`[whatsapp-${this.instanceId}]: Could not delete file ${file}: ${fileErr}`);
            }
          }
        } catch (dirErr) {
          logger.error(`[whatsapp-${this.instanceId}]: Error reading session directory: ${dirErr}`);
        }
      }
    }
  }
}
