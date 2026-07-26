import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import prisma from '../models/prismaClient';
import { WarmupStatusViewerService } from '../Warm-up/services/WarmupStatusViewerService';
import { WarmupGroupReaderService } from '../Warm-up/services/WarmupGroupReaderService';
import { WarmupIndividualReaderService } from '../Warm-up/services/WarmupIndividualReaderService';
import logger from '../utils/logger';
import { WaConnectionState, WaStatus } from '../types/whatsapp.types';
import { sanitizePhoneNumber } from '../utils/phoneUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const QR_TIMEOUT_MS  = 60_000;

// ─────────────────────────────────────────────────────────────────────────────
// Event Map
// ─────────────────────────────────────────────────────────────────────────────
export declare interface WhatsAppService {
  emit(event: 'wa:qr',         qrBase64: string):    boolean;
  emit(event: 'wa:open'):                            boolean;
  emit(event: 'wa:close',      reason?: number):     boolean;
  emit(event: 'wa:qr:timeout'):                      boolean;
  emit(event: 'wa:health',     score: number):       boolean;
  emit(event: 'message:status', payload: { messageId: string, status: 'delivered' | 'read' }): boolean;
  emit(event: 'wa:message', payload: { instanceId: number, messageId: string, fromNumber: string, text: string, timestamp: number, mediaUrl?: string, mediaType?: string }): boolean;

  on(event: 'wa:qr',         listener: (qrBase64: string)  => void): this;
  on(event: 'wa:open',       listener: ()                  => void): this;
  on(event: 'wa:close',      listener: (reason?: number)   => void): this;
  on(event: 'wa:qr:timeout', listener: ()                  => void): this;
  on(event: 'wa:health',     listener: (score: number)     => void): this;
  on(event: 'message:status', listener: (payload: { messageId: string, status: 'delivered' | 'read' }) => void): this;
  on(event: 'wa:message',    listener: (payload: { instanceId: number, messageId: string, fromNumber: string, text: string, timestamp: number, mediaUrl?: string, mediaType?: string }) => void): this;
}

export class WhatsAppService extends EventEmitter {
  private client: Client | null = null;
  private qrTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  private isManualOperation: boolean = false;
  private status: WaStatus = {
    state: WaConnectionState.CLOSE,
    lastUpdated: new Date(),
  };

  private healthScore: number = 100;
  private instanceId: number;
  private userId: number;

  constructor(instanceId: number, userId: number) {
    super();
    this.instanceId = instanceId;
    this.userId = userId;
    this.setMaxListeners(50);
  }

  getInstanceId(): number {
    return this.instanceId;
  }

  getUserId(): number {
    return this.userId;
  }

  async initialize(): Promise<void> {
    const instanceData = await prisma.whatsAppInstance.findUnique({
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

    let proxyUrlObj: URL | null = null;
    if (instanceData?.proxyUrl) {
      try {
        proxyUrlObj = new URL(instanceData.proxyUrl);
        puppeteerArgs.push(`--proxy-server=${proxyUrlObj.protocol}//${proxyUrlObj.hostname}:${proxyUrlObj.port}`);
        logger.info(`[whatsapp-${this.instanceId}]: Proxy Agent configured.`);
      } catch (err) {
        logger.error(`[whatsapp-${this.instanceId}]: Invalid proxy URL: ${instanceData.proxyUrl}`);
      }
    }

    this.client = new Client({
      authStrategy: new LocalAuth({
        clientId: `instance_${this.instanceId}`,
        dataPath: path.resolve(process.cwd(), 'sessions')
      }),
      puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        headless: true,
        args: puppeteerArgs
      }
    });

    this._registerEventListeners();

    logger.info(`[whatsapp-${this.instanceId}]: Initializing whatsapp-web.js client...`);
    
    try {
      await this.client.initialize();
      // Handle proxy auth if needed
      if (proxyUrlObj && proxyUrlObj.username && proxyUrlObj.password && this.client.pupPage) {
        await this.client.pupPage.authenticate({
          username: proxyUrlObj.username,
          password: proxyUrlObj.password
        });
      }
    } catch (e) {
      logger.error(`[whatsapp-${this.instanceId}]: Failed to initialize client: ${e}`);
    }
  }

  getStatus(): WaStatus {
    return { ...this.status };
  }

  getClient(): Client | null {
    return this.client;
  }

  async sendMessage(phoneNumber: string, text: string, delayMs = 1500, imagePath?: string): Promise<string> {
    if (!this.client || this.status.state !== WaConnectionState.OPEN) {
      throw new Boom('WhatsApp is not connected.', { statusCode: 503 });
    }

    const sanitized = sanitizePhoneNumber(phoneNumber);
    let jid = sanitized.includes('@c.us') ? sanitized : `${sanitized}@c.us`;

    try {
      const isRegistered = await this.client.isRegisteredUser(jid);
      if (!isRegistered) {
        logger.warn(`[whatsapp-${this.instanceId}]: Number ${jid} is not registered on WhatsApp.`);
      }
    } catch (e) {}

    const chat = await this.client.getChatById(jid);
    await chat.sendStateTyping();
    
    if (delayMs > 0) {
      await new Promise(r => setTimeout(r, delayMs));
    }
    await chat.clearState();

    let sentMsg;
    if (imagePath && fs.existsSync(imagePath)) {
      const media = MessageMedia.fromFilePath(imagePath);
      sentMsg = await this.client.sendMessage(jid, media, { caption: text });
    } else {
      sentMsg = await this.client.sendMessage(jid, text);
    }

    logger.info(`[whatsapp]: Message sent successfully to ${jid}`);
    return sentMsg.id.id || '';
  }

  async sendMedia(phoneNumber: string, mediaPath: string, mimeType: string, caption = '', originalName = ''): Promise<string> {
    if (!this.client || this.status.state !== WaConnectionState.OPEN) {
      throw new Boom('WhatsApp is not connected.', { statusCode: 503 });
    }

    const sanitized = sanitizePhoneNumber(phoneNumber);
    let jid = sanitized.includes('@c.us') ? sanitized : `${sanitized}@c.us`;

    const chat = await this.client.getChatById(jid);
    await chat.sendStateTyping();
    await new Promise(r => setTimeout(r, 1500));
    await chat.clearState();

    const media = MessageMedia.fromFilePath(mediaPath);
    // Explicitly set original name to force document mode for non-media types
    if (originalName) {
      media.filename = originalName;
    }

    const sentMsg = await this.client.sendMessage(jid, media, { caption });
    logger.info(`[whatsapp]: Media sent successfully to ${jid}`);
    return sentMsg.id.id || '';
  }

  public async logout(): Promise<void> {
    logger.info(`[whatsapp-${this.instanceId}]: Manual logout requested by user.`);
    this.isManualOperation = true;
    try {
      if (this.client) {
        await Promise.race([
          this.client.logout().catch(() => {}),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      }
      this._closeClient();
      this._updateStatus(WaConnectionState.CLOSE);
      this.emit('wa:close');
    } catch (err) {
      logger.error(`[whatsapp-${this.instanceId}]: Error during logout: ${err}`);
    } finally {
      this.isManualOperation = false;
    }
  }

  public async disconnect(): Promise<void> {
    logger.info(`[whatsapp-${this.instanceId}]: Manual disconnect (pause) requested by user.`);
    this.isManualOperation = true;
    try {
      this._closeClient();
      this._updateStatus(WaConnectionState.CLOSE);
      this.emit('wa:close');
    } catch (err) {
      logger.error(`[whatsapp-${this.instanceId}]: Error during disconnect: ${err}`);
    } finally {
      this.isManualOperation = false;
    }
  }

  public async restart(): Promise<void> {
    logger.info(`[whatsapp-${this.instanceId}]: Manual restart requested by user.`);
    this.isManualOperation = true;
    try {
      if (this.client) {
        try {
          await this.client.destroy();
        } catch(e) {}
      }
      this._closeClient();
      this._updateStatus(WaConnectionState.CLOSE);
      await this.initialize();
    } catch (err) {
      logger.error(`[whatsapp-${this.instanceId}]: Error during restart: ${err}`);
    } finally {
      this.isManualOperation = false;
    }
  }

  private _registerEventListeners(): void {
    if (!this.client) return;

    this.client.on('qr', async (qr: string) => {
      this._clearQrTimeout();
      logger.info(`[whatsapp-${this.instanceId}]: New QR Code generated. Waiting for scan...`);

      let qrBase64: string;
      try {
        qrBase64 = await QRCode.toDataURL(qr);
      } catch {
        logger.warn(`[whatsapp-${this.instanceId}]: QR encoding failed.`);
        qrBase64 = '';
      }

      this._updateStatus(WaConnectionState.CONNECTING, qrBase64);
      this.emit('wa:qr', qrBase64);

      this.qrTimeoutRef = setTimeout(() => {
        logger.warn(`[whatsapp-${this.instanceId}]: QR Code expired. Restarting connection...`);
        this.emit('wa:qr:timeout');
        this.restart().catch(() => {});
      }, QR_TIMEOUT_MS);
    });

    this.client.on('ready', () => {
      this._clearQrTimeout();
      logger.info(`[whatsapp-${this.instanceId}]: Connection established!`);
      this._updateStatus(WaConnectionState.OPEN);
      this.emit('wa:open');
    });

    this.client.on('disconnected', (reason: any) => {
      this._clearQrTimeout();
      logger.warn(`[whatsapp-${this.instanceId}]: Client disconnected. Reason: ${reason}`);
      this._updateStatus(WaConnectionState.CLOSE);
      this.emit('wa:close');

      if (!this.isManualOperation) {
        if (this.reconnectTimeoutRef) {
          clearTimeout(this.reconnectTimeoutRef);
        }
        this.reconnectTimeoutRef = setTimeout(() => {
          this.reconnectTimeoutRef = null;
          this.initialize().catch(() => {});
        }, 5_000);
      }
    });

    this.client.on('message_ack', (msg: any, ack: number) => {
      // ack: 1=Send, 2=Delivered, 3=Read
      const messageId = msg.id.id;
      if (ack === 2) {
        this.emit('message:status', { messageId, status: 'delivered' });
      } else if (ack === 3) {
        this.emit('message:status', { messageId, status: 'read' });
      }
    });

    this.client.on('message', async (msg: any) => {
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
            const uploadPath = path.resolve(process.cwd(), 'uploads', fileName);
            
            if (!fs.existsSync(path.resolve(process.cwd(), 'uploads'))) {
              fs.mkdirSync(path.resolve(process.cwd(), 'uploads'), { recursive: true });
            }
            fs.writeFileSync(uploadPath, Buffer.from(media.data, 'base64'));
            
            mediaUrl = `/uploads/${fileName}`;
          }
        } catch (err) {
          logger.error(`[whatsapp-${this.instanceId}]: Failed to download incoming media: ${err}`);
        }
      }

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
    });
  }

  private _updateStatus(state: WaConnectionState, qrCode?: string): void {
    this.status = {
      state,
      qrCode:      state === WaConnectionState.OPEN ? undefined : qrCode,
      lastUpdated: new Date(),
    };
  }

  private _clearQrTimeout(): void {
    if (this.qrTimeoutRef) {
      clearTimeout(this.qrTimeoutRef);
      this.qrTimeoutRef = null;
    }
  }

  public getHealthScore(): number {
    return this.healthScore;
  }

  public async setHealthScore(score: number): Promise<void> {
    this.healthScore = Math.max(0, Math.min(100, score));
    this.emit('wa:health', this.healthScore);
    try {
      await prisma.whatsAppInstance.update({
        where: { id: this.instanceId },
        data: { healthScore: this.healthScore }
      });
    } catch (e) {
      logger.error(`[whatsapp-${this.instanceId}]: Failed to update health score: ${e}`);
    }
  }

  public async deductHealth(points: number): Promise<void> {
    await this.setHealthScore(this.healthScore - points);
  }

  private _closeClient(): void {
    if (this.reconnectTimeoutRef) {
      clearTimeout(this.reconnectTimeoutRef);
      this.reconnectTimeoutRef = null;
    }
    if (this.client) {
      try {
        this.client.destroy();
      } catch (e) {}
      this.client = null;
    }
  }
}
