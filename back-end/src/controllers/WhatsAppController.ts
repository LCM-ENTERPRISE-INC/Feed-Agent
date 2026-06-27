import { Request, Response, NextFunction } from 'express';
import whatsAppService from '../services/WhatsAppService';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';

// SSE heartbeat interval (keep connection alive through proxies/load-balancers)
const SSE_HEARTBEAT_MS = 25_000;

/**
 * Handles HTTP endpoints for WhatsApp connection management.
 */
export class WhatsAppController {
  /**
   * GET /api/whatsapp/status
   * Returns the current WhatsApp connection state as a JSON snapshot.
   * Used by the dashboard for lightweight polling (e.g. every 5s after QR scan).
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = whatsAppService.getStatus();
      ApiResponse.success(res, status, 'WhatsApp status retrieved.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/whatsapp/qr/stream
   * Opens a Server-Sent Events (SSE) stream.
   *
   * Event types pushed to the client:
   *  - `qr`          — new QR Code ready  { qrCode: "<base64 PNG>" }
   *  - `connected`   — device scanned and session established
   *  - `disconnected`— connection dropped  { reason: <number | null> }
   *  - `qr:timeout`  — QR expired without scan
   *  - `heartbeat`   — keepalive ping every 25s
   *
   * The client should use the native `EventSource` API with the JWT token
   * passed as a query param: `/api/whatsapp/qr/stream?token=<jwt>`
   */
  streamQr(req: Request, res: Response): void {
    // ── Set SSE headers ───────────────────────────────────────────────────
    res.setHeader('Content-Type',                'text/event-stream');
    res.setHeader('Cache-Control',               'no-cache, no-transform');
    res.setHeader('Connection',                  'keep-alive');
    res.setHeader('X-Accel-Buffering',           'no'); // Disable Nginx buffering
    res.flushHeaders();

    logger.info(`[whatsapp/sse]: New SSE client connected from ${req.ip}`);

    // ── Helper to push typed SSE events ──────────────────────────────────
    const pushEvent = (event: string, data: object | null = null): void => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
    };

    // ── Send the current status immediately so the client doesn't wait ────
    const current = whatsAppService.getStatus();
    if (current.qrCode) {
      pushEvent('qr', { qrCode: current.qrCode });
    } else {
      pushEvent(current.state === 'open' ? 'connected' : 'disconnected', { state: current.state });
    }

    // ── Register event handlers ───────────────────────────────────────────
    const onQr         = (qrCode: string)  => pushEvent('qr',           { qrCode });
    const onOpen       = ()                => pushEvent('connected',     null);
    const onClose      = (reason?: number) => pushEvent('disconnected',  { reason: reason ?? null });
    const onQrTimeout  = ()                => pushEvent('qr:timeout',    null);

    whatsAppService.on('wa:qr',         onQr);
    whatsAppService.on('wa:open',       onOpen);
    whatsAppService.on('wa:close',      onClose);
    whatsAppService.on('wa:qr:timeout', onQrTimeout);

    // ── Heartbeat — keeps connection alive through proxies ────────────────
    const heartbeat = setInterval(() => {
      pushEvent('heartbeat', { ts: new Date().toISOString() });
    }, SSE_HEARTBEAT_MS);

    // ── Cleanup when the client disconnects ───────────────────────────────
    req.on('close', () => {
      logger.info(`[whatsapp/sse]: SSE client disconnected from ${req.ip}`);
      clearInterval(heartbeat);
      whatsAppService.off('wa:qr',         onQr);
      whatsAppService.off('wa:open',       onOpen);
      whatsAppService.off('wa:close',      onClose);
      whatsAppService.off('wa:qr:timeout', onQrTimeout);
    });
  }

  /**
   * POST /api/whatsapp/test-message
   * Endpoint strictly for administrators to test the WhatsApp connection.
   * Sends a simple text payload to the provided phone number.
   */
  async sendTestMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        throw new AppError('phoneNumber and message are required in the body.', 400);
      }

      await whatsAppService.sendMessage(phoneNumber, message);
      
      ApiResponse.success(res, null, 'Test message queued for sending.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/restart
   * Restarts the WhatsApp session to generate a new QR Code.
   */
  async restart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await whatsAppService.restart();
      ApiResponse.success(res, null, 'WhatsApp session restarted and new QR generation initiated.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/logout
   * Logs out from the active WhatsApp session and clears credentials.
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await whatsAppService.logout();
      ApiResponse.success(res, null, 'WhatsApp session disconnected successfully.');
    } catch (err) {
      next(err);
    }
  }
}

export default new WhatsAppController();
