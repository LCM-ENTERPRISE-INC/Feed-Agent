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

  on(event: 'wa:qr',         listener: (qrBase64: string)  => void): this;
  on(event: 'wa:open',       listener: ()                  => void): this;
  on(event: 'wa:close',      listener: (reason?: number)   => void): this;
  on(event: 'wa:qr:timeout', listener: ()                  => void): this;
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

    this.socket = makeWASocket({
      version,
      auth:              authState,
      logger:            { level: 'silent' } as any,
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
  async sendMessage(phoneNumber: string, text: string, delayMs = 1500): Promise<void> {
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

    // 4. Send the actual message and clear typing status
    await this.socket.sendPresenceUpdate('paused', jid);
    await this.socket.sendMessage(jid, { text });

    logger.info(`[whatsapp]: Message sent successfully to ${jid}`);
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
          logger.warn(`[whatsapp]: Connection closed. Reason code: ${reason}. Reconnecting in 5s...`);
          this.emit('wa:close', reason);
          setTimeout(() => this.initialize(), 5_000);
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
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }
  }

  /** Removes all session files, forcing a fresh QR scan on next initialize(). */
  private _clearSession(): void {
    if (fs.existsSync(SESSIONS_DIR)) {
      fs.rmSync(SESSIONS_DIR, { recursive: true, force: true });
      logger.info('[whatsapp]: Session directory cleared.');
    }
  }
}

export default new WhatsAppService();
