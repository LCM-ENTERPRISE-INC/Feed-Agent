import { Request, Response, NextFunction } from 'express';
import whatsAppInstanceManager from '../services/WhatsAppInstanceManager';
import prisma from '../models/prismaClient';
import { ApiResponse } from '../utils/ApiResponse';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';
import ChatMessage from '../models/ChatMessage';

// SSE heartbeat interval (keep connection alive through proxies/load-balancers)
const SSE_HEARTBEAT_MS = 25_000;

/**
 * Handles HTTP endpoints for WhatsApp connection management.
 */
export class WhatsAppController {
  
  /**
   * GET /api/whatsapp/instances
   * Returns all WhatsApp instances for the authenticated user along with their live state.
   */
  async getInstances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const dbInstances = await prisma.whatsAppInstance.findMany({
        where: { userId },
        orderBy: { id: 'asc' }
      });

      const instances = dbInstances.map((inst: any) => {
        const liveInstance = whatsAppInstanceManager.getInstance(inst.id);
        const liveStatus = liveInstance ? liveInstance.getStatus() : { state: 'DISCONNECTED' };
        
        return {
          id: inst.id,
          name: inst.name,
          dbStatus: inst.status,
          liveStatus
        };
      });

      ApiResponse.success(res, instances, 'WhatsApp instances retrieved.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/instances
   * Creates a new WhatsApp instance slot for the user. Max 5 slots allowed.
   */
  async createInstance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { name } = req.body;

      const currentCount = await prisma.whatsAppInstance.count({ where: { userId } });
      if (currentCount >= 500) {
        throw new AppError('Você atingiu o limite máximo de 500 conexões do WhatsApp.', 403);
      }

      const instanceName = name || `Dispositivo ${currentCount + 1}`;

      const newInstance = await prisma.whatsAppInstance.create({
        data: {
          userId,
          name: instanceName,
          status: 'DISCONNECTED'
        }
      });

      // Initialize the live instance
      whatsAppInstanceManager.addInstance(newInstance.id, userId);

      ApiResponse.success(res, newInstance, 'Nova instância WhatsApp criada.', 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/whatsapp/instances/:id
   * Removes a WhatsApp instance, logs it out, and deletes the DB record.
   */
  async deleteInstance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const instanceId = parseInt(req.params.id as string, 10);

      const instance = await prisma.whatsAppInstance.findFirst({
        where: { id: instanceId, userId }
      });

      if (!instance) {
        throw new AppError('Instância não encontrada.', 404);
      }

      // Remove live instance (triggers logout and session wipe)
      await whatsAppInstanceManager.removeInstance(instanceId);

      // Delete DB record
      await prisma.whatsAppInstance.delete({
        where: { id: instanceId }
      });

      ApiResponse.success(res, null, 'Instância removida com sucesso.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/whatsapp/instances/:id/stream
   * Opens a Server-Sent Events (SSE) stream for a specific instance.
   */
  streamQr(req: Request, res: Response): void {
    const userId = req.user?.userId;
    const instanceId = parseInt(req.params.id as string, 10);

    if (!userId || isNaN(instanceId)) {
      res.status(400).end();
      return;
    }

    const liveInstance = whatsAppInstanceManager.getInstance(instanceId);
    if (!liveInstance || liveInstance.getUserId() !== userId) {
      res.status(404).json({ message: 'Instance not found or not active.' });
      return;
    }

    // ── Set SSE headers ───────────────────────────────────────────────────
    res.setHeader('Content-Type',                'text/event-stream');
    res.setHeader('Cache-Control',               'no-cache, no-transform');
    res.setHeader('Connection',                  'keep-alive');
    res.setHeader('X-Accel-Buffering',           'no'); // Disable Nginx buffering
    res.flushHeaders();

    logger.info(`[whatsapp-sse]: Client connected for instance ${instanceId} from ${req.ip}`);

    // ── Helper to push typed SSE events ──────────────────────────────────
    const pushEvent = (event: string, data: object | null = null): void => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
    };

    // ── Send the current status immediately ───────────────────────────────
    const current = liveInstance.getStatus();
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

    liveInstance.on('wa:qr',         onQr);
    liveInstance.on('wa:open',       onOpen);
    liveInstance.on('wa:close',      onClose);
    liveInstance.on('wa:qr:timeout', onQrTimeout);

    // ── Heartbeat — keeps connection alive through proxies ────────────────
    const heartbeat = setInterval(() => {
      pushEvent('heartbeat', { ts: new Date().toISOString() });
    }, SSE_HEARTBEAT_MS);

    // ── Cleanup when the client disconnects ───────────────────────────────
    req.on('close', () => {
      logger.info(`[whatsapp-sse]: Client disconnected for instance ${instanceId}`);
      clearInterval(heartbeat);
      liveInstance.off('wa:qr',         onQr);
      liveInstance.off('wa:open',       onOpen);
      liveInstance.off('wa:close',      onClose);
      liveInstance.off('wa:qr:timeout', onQrTimeout);
    });
  }

  /**
   * GET /api/whatsapp/instances/:id/messages/stream
   * Opens an SSE stream to receive real-time messages from this instance.
   */
  streamMessages(req: Request, res: Response): void {
    const userId = req.user?.userId;
    const instanceId = parseInt(req.params.id as string, 10);

    if (!userId || isNaN(instanceId)) {
      res.status(400).end();
      return;
    }

    const liveInstance = whatsAppInstanceManager.getInstance(instanceId);
    if (!liveInstance || liveInstance.getUserId() !== userId) {
      res.status(404).json({ message: 'Instance not found or not active.' });
      return;
    }

    // ── Set SSE headers ───────────────────────────────────────────────────
    res.setHeader('Content-Type',                'text/event-stream');
    res.setHeader('Cache-Control',               'no-cache, no-transform');
    res.setHeader('Connection',                  'keep-alive');
    res.setHeader('X-Accel-Buffering',           'no');
    res.flushHeaders();

    logger.info(`[whatsapp-messages-sse]: Client connected for instance ${instanceId}`);

    // Helper to push typed SSE events
    const pushEvent = (event: string, data: object | null = null): void => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data ?? {})}\n\n`);
    };

    // Confirm connection immediately
    pushEvent('connected', { instanceId, message: 'Listening for incoming messages...' });

    // Handle incoming messages
    const onMessage = (payload: any) => {
      pushEvent('message', payload);
    };

    liveInstance.on('wa:message', onMessage);

    // Heartbeat
    const heartbeat = setInterval(() => {
      pushEvent('heartbeat', { ts: new Date().toISOString() });
    }, SSE_HEARTBEAT_MS);

    // Cleanup on close
    req.on('close', () => {
      logger.info(`[whatsapp-messages-sse]: Client disconnected for instance ${instanceId}`);
      clearInterval(heartbeat);
      liveInstance.off('wa:message', onMessage);
    });
  }

  /**
   * POST /api/whatsapp/instances/:id/send-message
   */
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const instanceId = parseInt(req.params.id as string, 10);
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        throw new AppError('phoneNumber and message are required in the body.', 400);
      }

      const liveInstance = whatsAppInstanceManager.getInstance(instanceId);
      if (!liveInstance || liveInstance.getUserId() !== userId) {
        throw new AppError('Instância não ativa ou não autorizada.', 404);
      }

      const messageId = await liveInstance.sendMessage(phoneNumber, message);
      
      try {
        await ChatMessage.create({
          instanceId,
          fromNumber: phoneNumber,
          text: message,
          fromMe: true,
          timestamp: Date.now(),
          messageId: messageId || `sent-${Date.now()}`
        });
      } catch (err: any) {
        logger.error(`[whatsapp-controller]: Erro ao salvar mensagem enviada no mongoDB: ${err.message}`);
      }
      
      ApiResponse.success(res, null, 'Mensagem enviada.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/instances/:id/send-media
   */
  async sendMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const instanceId = parseInt(req.params.id as string, 10);
      const { phoneNumber, caption } = req.body;
      const file = req.file;

      if (!phoneNumber || !file) {
        throw new AppError('phoneNumber and file are required.', 400);
      }

      const liveInstance = whatsAppInstanceManager.getInstance(instanceId);
      if (!liveInstance || liveInstance.getUserId() !== userId) {
        throw new AppError('Instância não ativa ou não autorizada.', 404);
      }

      const mediaPath = file.path;
      const mimeType = file.mimetype;
      const originalName = file.originalname;

      const messageId = await liveInstance.sendMedia(phoneNumber, mediaPath, mimeType, caption || '', originalName);
      
      try {
        await ChatMessage.create({
          instanceId,
          fromNumber: phoneNumber,
          text: caption || '',
          fromMe: true,
          timestamp: Date.now(),
          messageId: messageId || `sent-${Date.now()}`,
          mediaUrl: `/uploads/${file.filename}`,
          mediaType: mimeType
        });
      } catch (err: any) {
        logger.error(`[whatsapp-controller]: Erro ao salvar mensagem de mídia no mongoDB: ${err.message}`);
      }
      
      ApiResponse.success(res, null, 'Mídia enviada.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/instances/:id/restart
   */
  async restart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const instanceId = parseInt(req.params.id as string, 10);

      const liveInstance = whatsAppInstanceManager.getInstance(instanceId);
      if (!liveInstance || liveInstance.getUserId() !== userId) {
        throw new AppError('Instância não ativa.', 404);
      }

      await liveInstance.restart();
      ApiResponse.success(res, null, 'Sessão reiniciada.');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/instances/:id/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const instanceId = parseInt(req.params.id as string, 10);

      const liveInstance = whatsAppInstanceManager.getInstance(instanceId);
      if (!liveInstance || liveInstance.getUserId() !== userId) {
        throw new AppError('Instância não ativa.', 404);
      }

      await liveInstance.disconnect();
      ApiResponse.success(res, null, 'WhatsApp pausado (desconectado).');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/whatsapp/instances/:id/connect
   * Reconecta uma sessão previamente pausada.
   */
  async connect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const instanceId = parseInt(req.params.id as string, 10);

      const liveInstance = whatsAppInstanceManager.getInstance(instanceId);
      if (!liveInstance || liveInstance.getUserId() !== userId) {
        throw new AppError('Instância não ativa.', 404);
      }

      await liveInstance.initialize();
      ApiResponse.success(res, null, 'Reconectando ao WhatsApp...');
    } catch (err) {
      next(err);
    }
  }
  /**
   * GET /api/whatsapp/instances/:id/messages
   */
  async getChatHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const instanceId = parseInt(req.params.id as string, 10);
      const contact = req.query.contact as string;

      if (!contact) {
        throw new AppError('O parâmetro de query "contact" é obrigatório.', 400);
      }

      const liveInstance = whatsAppInstanceManager.getInstance(instanceId);
      if (!liveInstance || liveInstance.getUserId() !== userId) {
        throw new AppError('Instância não ativa ou não autorizada.', 404);
      }

      const messages = await ChatMessage.find({
        instanceId,
        fromNumber: contact
      }).sort({ timestamp: 1 }).limit(100);

      ApiResponse.success(res, messages, 'Histórico de mensagens recuperado.');
    } catch (err) {
      next(err);
    }
  }
}

export default new WhatsAppController();
