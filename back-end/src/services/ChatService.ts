import ChatMessage, { ChatMessageStatus, IChatMessage } from '../models/ChatMessage';
import prisma from '../models/prismaClient';
import { AppError } from '../utils/AppError';
import logger from '../utils/logger';
import { chatLogFields } from '../utils/logMask';
import { phoneLookupVariants, sanitizePhoneNumber } from '../utils/phoneUtils';
import type { WhatsAppService } from './WhatsAppService';

// Lazy import avoids circular init with WhatsAppInstanceManager
function getInstanceManager() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./WhatsAppInstanceManager').default as {
    getInstance(id: number): WhatsAppService | undefined;
  };
}

export interface ChatConversationDto {
  contactPhone: string;
  contactName: string | null;
  instanceId: number;
  lastMessageText: string | null;
  lastMessageAt: number;
  lastFromMe: boolean;
  lastStatus: ChatMessageStatus | null;
  unreadCount: number;
}

export interface ChatMessageDto {
  id: string;
  messageId: string;
  clientMessageId?: string;
  text?: string;
  fromMe: boolean;
  timestamp: number;
  status: ChatMessageStatus;
  mediaUrl?: string;
  mediaType?: string;
  instanceId: number;
  contactPhone: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface InboundMessagePayload {
  instanceId: number;
  messageId: string;
  fromNumber: string;
  text?: string;
  timestamp: number;
  mediaUrl?: string;
  mediaType?: string;
}

export interface OutboundSendInput {
  userId: number;
  instanceId: number;
  phoneNumber: string;
  message: string;
  clientMessageId?: string;
}

function encodeCursor(timestamp: number, messageId: string): string {
  return Buffer.from(JSON.stringify({ t: timestamp, id: messageId }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { t: number; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed?.t !== 'number' || typeof parsed?.id !== 'string') {
      throw new Error('invalid');
    }
    return { t: parsed.t, id: parsed.id };
  } catch {
    throw new AppError('Cursor de paginação inválido.', 400);
  }
}

function toDto(doc: IChatMessage): ChatMessageDto {
  return {
    id: String(doc._id),
    messageId: doc.messageId,
    clientMessageId: doc.clientMessageId,
    text: doc.text,
    fromMe: doc.fromMe,
    timestamp: doc.timestamp,
    status: doc.status,
    mediaUrl: doc.mediaUrl,
    mediaType: doc.mediaType,
    instanceId: doc.instanceId,
    contactPhone: doc.fromNumber,
  };
}

/**
 * Chat domain: conversations, message persistence, send lifecycle, isolation.
 * WhatsApp transport is injected via WhatsAppInstanceManager (mockable in tests).
 */
export class ChatService {
  /**
   * Ensures the WhatsApp instance belongs to the user (DB). Live socket optional.
   */
  async assertInstanceOwnership(userId: number, instanceId: number) {
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, userId },
    });
    if (!instance) {
      throw new AppError('Instância não encontrada.', 404);
    }
    return instance;
  }

  /**
   * Live connected instance owned by user, or throws with a clear disconnected message.
   */
  async requireConnectedInstance(userId: number, instanceId: number) {
    await this.assertInstanceOwnership(userId, instanceId);
    const live = getInstanceManager().getInstance(instanceId);
    if (!live || live.getUserId() !== userId) {
      throw new AppError('Canal WhatsApp desconectado. Reconecte o canal antes de enviar.', 503);
    }
    const status = live.getStatus();
    if (status.state !== 'open') {
      throw new AppError('Canal WhatsApp desconectado. Reconecte o canal antes de enviar.', 503);
    }
    return live;
  }

  async listConversations(
    userId: number,
    opts: { limit?: number; cursor?: string } = {}
  ): Promise<CursorPage<ChatConversationDto>> {
    const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);

    // Latest message per contact, then paginate by that last activity.
    const pipeline: object[] = [
      { $match: { userId } },
      { $sort: { timestamp: -1, messageId: -1 } },
      {
        $group: {
          _id: '$fromNumber',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$fromMe', false] }, { $eq: ['$unread', true] }] }, 1, 0],
            },
          },
        },
      },
      { $sort: { 'lastMessage.timestamp': -1, 'lastMessage.messageId': -1 } },
    ];

    if (opts.cursor) {
      const { t, id } = decodeCursor(opts.cursor);
      pipeline.push({
        $match: {
          $or: [
            { 'lastMessage.timestamp': { $lt: t } },
            {
              'lastMessage.timestamp': t,
              'lastMessage.messageId': { $lt: id },
            },
          ],
        },
      });
    }

    pipeline.push({ $limit: limit + 1 });

    const rows = await ChatMessage.aggregate(pipeline as import('mongoose').PipelineStage[]);
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    const phones = slice.map((r) => r._id as string);
    const contacts = phones.length
      ? await prisma.contact.findMany({
          where: {
            userId,
            phoneNumber: { in: [...new Set(phones.flatMap((p) => phoneLookupVariants(p)))] },
          },
          select: { phoneNumber: true, name: true },
        })
      : [];

    const nameByPhone = new Map<string, string>();
    for (const c of contacts) {
      for (const v of phoneLookupVariants(c.phoneNumber)) {
        nameByPhone.set(v, c.name);
      }
    }

    const items: ChatConversationDto[] = slice.map((r) => {
      const last = r.lastMessage;
      const phone = String(r._id);
      return {
        contactPhone: phone,
        contactName: nameByPhone.get(phone) ?? null,
        instanceId: last.instanceId,
        lastMessageText: last.text ?? null,
        lastMessageAt: last.timestamp,
        lastFromMe: !!last.fromMe,
        lastStatus: last.status ?? null,
        unreadCount: r.unreadCount ?? 0,
      };
    });

    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor(last.lastMessage.timestamp, last.lastMessage.messageId)
        : null;

    return { items, nextCursor, hasMore };
  }

  async listMessages(
    userId: number,
    instanceId: number,
    contactRaw: string,
    opts: { limit?: number; cursor?: string; before?: boolean } = {}
  ): Promise<CursorPage<ChatMessageDto>> {
    await this.assertInstanceOwnership(userId, instanceId);

    const contact = sanitizePhoneNumber(contactRaw);
    const variants = phoneLookupVariants(contact);
    const limit = Math.min(Math.max(opts.limit ?? 40, 1), 100);

    const filter: Record<string, unknown> = {
      userId,
      instanceId,
      fromNumber: { $in: variants },
    };

    if (opts.cursor) {
      const { t, id } = decodeCursor(opts.cursor);
      // Older messages when scrolling up (before = true): timestamp < cursor
      filter.$or = [
        { timestamp: { $lt: t } },
        { timestamp: t, messageId: { $lt: id } },
      ];
    }

    const docs = await ChatMessage.find(filter)
      .sort({ timestamp: -1, messageId: -1 })
      .limit(limit + 1)
      .exec();

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    // Return chronological for UI
    const chronological = [...page].reverse();
    const items = chronological.map(toDto);

    const oldest = page[page.length - 1];
    const nextCursor =
      hasMore && oldest ? encodeCursor(oldest.timestamp, oldest.messageId) : null;

    return { items, nextCursor, hasMore };
  }

  async markConversationRead(userId: number, instanceId: number, contactRaw: string): Promise<void> {
    await this.assertInstanceOwnership(userId, instanceId);
    const variants = phoneLookupVariants(sanitizePhoneNumber(contactRaw));
    await ChatMessage.updateMany(
      { userId, instanceId, fromNumber: { $in: variants }, fromMe: false, unread: true },
      { $set: { unread: false } }
    );
  }

  /**
   * Persist inbound message, upsert contact lightly, emit-ready DTO.
   */
  async persistInbound(userId: number, payload: InboundMessagePayload): Promise<ChatMessageDto | null> {
    let phone: string;
    try {
      phone = sanitizePhoneNumber(payload.fromNumber);
    } catch {
      phone = payload.fromNumber.replace(/\D/g, '');
    }

    try {
      const doc = await ChatMessage.create({
        userId,
        instanceId: payload.instanceId,
        fromNumber: phone,
        text: payload.text,
        fromMe: false,
        timestamp: payload.timestamp,
        messageId: payload.messageId,
        status: 'DELIVERED',
        mediaUrl: payload.mediaUrl,
        mediaType: payload.mediaType,
        unread: true,
      });

      // Best-effort contact upsert without creating phone-format duplicates
      try {
        const variants = phoneLookupVariants(phone);
        const existing = await prisma.contact.findFirst({
          where: { userId, phoneNumber: { in: variants } },
        });
        if (!existing) {
          await prisma.contact.create({
            data: {
              userId,
              phoneNumber: phone,
              name: `+${phone}`,
              active: true,
            },
          });
        }
      } catch (err: any) {
        // Unique race is fine
        if (err?.code !== 'P2002') {
          logger.warn('[chat]: contact upsert skipped', chatLogFields({ userId, phone, messageId: payload.messageId }));
        }
      }

      logger.info(
        '[chat]: inbound persisted',
        chatLogFields({
          userId,
          instanceId: payload.instanceId,
          phone,
          messageId: payload.messageId,
          status: 'DELIVERED',
          text: payload.text,
        })
      );

      return toDto(doc);
    } catch (err: any) {
      if (err?.code === 11000) {
        const existing = await ChatMessage.findOne({ messageId: payload.messageId });
        return existing ? toDto(existing) : null;
      }
      logger.error(
        '[chat]: inbound persist failed',
        chatLogFields({ userId, instanceId: payload.instanceId, phone, messageId: payload.messageId })
      );
      throw err;
    }
  }

  async updateStatusByMessageId(
    messageId: string,
    status: 'delivered' | 'read'
  ): Promise<IChatMessage | null> {
    const mapped: ChatMessageStatus = status === 'read' ? 'READ' : 'DELIVERED';
    const current = await ChatMessage.findOne({ messageId });
    if (!current) return null;

    const order: ChatMessageStatus[] = ['PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED'];
    const curIdx = order.indexOf(current.status);
    const nextIdx = order.indexOf(mapped);
    if (curIdx >= 0 && nextIdx >= 0 && nextIdx < curIdx) {
      return current;
    }
    if (current.status === 'FAILED') return current;

    current.status = mapped;
    await current.save();
    return current;
  }

  /**
   * Individual send: validate → PENDING → transport → SENT (or FAILED).
   * Idempotent on clientMessageId per user (retry without duplicates).
   */
  async sendText(input: OutboundSendInput): Promise<ChatMessageDto> {
    const { userId, instanceId } = input;
    if (!input.message?.trim()) {
      throw new AppError('Mensagem vazia.', 400);
    }
    const phone = sanitizePhoneNumber(input.phoneNumber);
    const text = input.message.trim();

    if (input.clientMessageId) {
      const existing = await ChatMessage.findOne({ userId, clientMessageId: input.clientMessageId });
      if (existing) {
        if (existing.status === 'FAILED') {
          return this.retryFailed(existing, userId);
        }
        return toDto(existing);
      }
    }

    const live = await this.requireConnectedInstance(userId, instanceId);
    const pendingId = input.clientMessageId
      ? `client:${userId}:${input.clientMessageId}`
      : `pending:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

    let pending: IChatMessage;
    try {
      pending = await ChatMessage.create({
        userId,
        instanceId,
        fromNumber: phone,
        text,
        fromMe: true,
        timestamp: Date.now(),
        messageId: pendingId,
        clientMessageId: input.clientMessageId,
        status: 'PENDING',
        unread: false,
      });
    } catch (err: any) {
      if (err?.code === 11000 && input.clientMessageId) {
        const existing = await ChatMessage.findOne({ userId, clientMessageId: input.clientMessageId });
        if (existing) return toDto(existing);
      }
      throw err;
    }

    try {
      const transportId = await live.sendMessage(phone, text, 500);
      const finalId = transportId || pendingId;

      if (finalId !== pending.messageId) {
        // Prefer transport id; remove pending row and recreate / update carefully
        await ChatMessage.deleteOne({ _id: pending._id });
        try {
          pending = await ChatMessage.create({
            userId,
            instanceId,
            fromNumber: phone,
            text,
            fromMe: true,
            timestamp: Date.now(),
            messageId: finalId,
            clientMessageId: input.clientMessageId,
            status: 'SENT',
            unread: false,
          });
        } catch (dup: any) {
          if (dup?.code === 11000) {
            const again = await ChatMessage.findOne({ messageId: finalId });
            if (again) return toDto(again);
          }
          throw dup;
        }
      } else {
        pending.status = 'SENT';
        await pending.save();
      }

      logger.info(
        '[chat]: outbound sent',
        chatLogFields({
          userId,
          instanceId,
          phone,
          messageId: pending.messageId,
          status: 'SENT',
          text,
        })
      );

      return toDto(pending);
    } catch (err: any) {
      pending.status = 'FAILED';
      pending.errorCode = String(err?.statusCode || err?.message || 'SEND_FAILED').slice(0, 80);
      await pending.save();
      logger.error(
        '[chat]: outbound failed',
        chatLogFields({
          userId,
          instanceId,
          phone,
          messageId: pending.messageId,
          status: 'FAILED',
          text,
        })
      );
      throw new AppError('Falha ao enviar mensagem. Você pode tentar novamente.', 502);
    }
  }

  private async retryFailed(existing: IChatMessage, userId: number): Promise<ChatMessageDto> {
    const live = await this.requireConnectedInstance(userId, existing.instanceId);
    existing.status = 'PENDING';
    existing.errorCode = undefined;
    await existing.save();

    try {
      const transportId = await live.sendMessage(existing.fromNumber, existing.text || '', 500);
      if (transportId && transportId !== existing.messageId) {
        const oldClient = existing.clientMessageId;
        const phone = existing.fromNumber;
        const text = existing.text;
        const instanceId = existing.instanceId;
        const ts = Date.now();
        await ChatMessage.deleteOne({ _id: existing._id });
        const created = await ChatMessage.create({
          userId,
          instanceId,
          fromNumber: phone,
          text,
          fromMe: true,
          timestamp: ts,
          messageId: transportId,
          clientMessageId: oldClient,
          status: 'SENT',
          unread: false,
        });
        return toDto(created);
      }
      existing.status = 'SENT';
      await existing.save();
      return toDto(existing);
    } catch (err: any) {
      existing.status = 'FAILED';
      existing.errorCode = String(err?.statusCode || err?.message || 'SEND_FAILED').slice(0, 80);
      await existing.save();
      throw new AppError('Falha ao reenviar mensagem.', 502);
    }
  }

  async persistOutboundMedia(input: {
    userId: number;
    instanceId: number;
    phoneNumber: string;
    caption?: string;
    messageId: string;
    mediaUrl: string;
    mediaType: string;
  }): Promise<ChatMessageDto> {
    const phone = sanitizePhoneNumber(input.phoneNumber);
    try {
      const doc = await ChatMessage.create({
        userId: input.userId,
        instanceId: input.instanceId,
        fromNumber: phone,
        text: input.caption || '',
        fromMe: true,
        timestamp: Date.now(),
        messageId: input.messageId,
        status: 'SENT',
        mediaUrl: input.mediaUrl,
        mediaType: input.mediaType,
        unread: false,
      });
      return toDto(doc);
    } catch (err: any) {
      if (err?.code === 11000) {
        const existing = await ChatMessage.findOne({ messageId: input.messageId });
        if (existing) return toDto(existing);
      }
      throw err;
    }
  }
}

export default new ChatService();
