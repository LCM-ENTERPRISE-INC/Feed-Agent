import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  ConnectionState,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode';
import logger from '../utils/logger';
import { WaConnectionState, WaStatus } from '../types/whatsapp.types';
import { sanitizePhoneNumber, toWhatsAppJid } from '../utils/phoneUtils';
import { delay } from '@whiskeysockets/baileys';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SESSIONS_DIR   = path.resolve(process.cwd(), 'sessions');
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

  on(event: 'wa:qr',         listener: (qrBase64: string)  => void): this;
  on(event: 'wa:open',       listener: ()                  => void): this;
  on(event: 'wa:close',      listener: (reason?: number)   => void): this;
  on(event: 'wa:qr:timeout', listener: ()                  => void): this;
  on(event: 'message:status', listener: (payload: { messageId: string, status: 'delivered' | 'read' }) => void): this;
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

  constructor() {
    super();
    // Avoid Node.js MaxListenersExceededWarning for many SSE clients
    this.setMaxListeners(50);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Initializes (or re-initializes) the Baileys WebSocket connection.
   * Loads existing session from disk. If no session exists, a QR Code is
   * generated, emitted via `wa:qr` event, and available in `getStatus()`.
   */
  async initialize(): Promise<void> {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    const { version } = await fetchLatestBaileysVersion();
    logger.info(`[whatsapp]: Using Baileys v${version.join('.')}`);

    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR);

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
    const jid = toWhatsAppJid(sanitized);

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
   * Manually logs out from the current Baileys session and cleans up disk files.
   * Emits 'wa:close' to notify clients that the session was ended by the user.
   */
  public async logout(): Promise<void> {
    logger.info('[whatsapp]: Manual logout requested by user.');
    this.isManualOperation = true;
    try {
      if (this.socket) {
        await this.socket.logout('Manual logout requested via API').catch(() => {});
      }
      this._closeSocket();
      this._clearSession();
      this._updateStatus(WaConnectionState.CLOSE);
      this.emit('wa:close');
    } finally {
      this.isManualOperation = false;
    }
  }

  /**
   * Cleans up the current session and reinitializes a fresh one to generate a new QR Code.
   */
  public async restart(): Promise<void> {
    logger.info('[whatsapp]: Manual restart requested by user to generate new QR Code.');
    this.isManualOperation = true;
    try {
      this._closeSocket();
      this._clearSession();
      await this.initialize();
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
          qrBase64 = await qrcode.toDataURL(qr);
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
          logger.error(`[whatsapp]: 🚨 CRITICAL ALERT: WhatsApp account has been BANNED or FORBIDDEN (Code: 403).`);
          this.emit('wa:close', reason);
          this._clearSession();
        } else if (isLoggedOut) {
          logger.warn('[whatsapp]: Logged out from device. Clearing session files...');
          this.emit('wa:close', reason);
          this._clearSession();
        } else {
          logger.warn(`[whatsapp]: Connection closed. Reason code: ${reason}. ${this.isManualOperation ? 'Manual operation in progress, skipping auto-reconnect.' : 'Reconnecting in 5s...'}`);
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
  private _clearSession(): void {
    if (fs.existsSync(SESSIONS_DIR)) {
      try {
        fs.rmSync(SESSIONS_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
        logger.info('[whatsapp]: Session directory cleared.');
      } catch (err) {
        logger.error(`[whatsapp]: Failed to clear session directory, trying to delete files individually: ${err}`);
        try {
          const files = fs.readdirSync(SESSIONS_DIR);
          for (const file of files) {
            try {
              const filePath = path.join(SESSIONS_DIR, file);
              if (fs.lstatSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
            } catch (fileErr) {
              logger.warn(`[whatsapp]: Could not delete file ${file}: ${fileErr}`);
            }
          }
        } catch (dirErr) {
          logger.error(`[whatsapp]: Error reading session directory: ${dirErr}`);
        }
      }
    }
  }
}

export default new WhatsAppService();
