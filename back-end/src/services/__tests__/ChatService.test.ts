import { EventEmitter } from 'events';
import { ChatService } from '../ChatService';
import { WaConnectionState } from '../../types/whatsapp.types';

const store: any[] = [];

function matchesFilter(doc: any, filter: any): boolean {
  if (!filter) return true;
  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or') {
      const ok = (value as any[]).some((clause) => matchesFilter(doc, clause));
      if (!ok) return false;
      continue;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('$in' in value) {
        if (!(value as any).$in.includes(doc[key])) return false;
      } else if ('$lt' in value) {
        if (!(doc[key] < (value as any).$lt)) return false;
      } else if ('$eq' in value) {
        if (doc[key] !== (value as any).$eq) return false;
      } else {
        return false;
      }
    } else if (doc[key] !== value) {
      return false;
    }
  }
  return true;
}

jest.mock('../../models/ChatMessage', () => {
  const api: any = {
    create: jest.fn(async (data: any) => {
      if (store.some((d) => d.messageId === data.messageId)) {
        const err: any = new Error('duplicate');
        err.code = 11000;
        throw err;
      }
      if (data.clientMessageId && store.some((d) => d.userId === data.userId && d.clientMessageId === data.clientMessageId)) {
        const err: any = new Error('duplicate client');
        err.code = 11000;
        throw err;
      }
      const doc = {
        ...data,
        _id: `id-${store.length + 1}`,
        save: jest.fn(async function (this: any) {
          return this;
        }),
      };
      store.push(doc);
      return doc;
    }),
    findOne: jest.fn(async (filter: any) => store.find((d) => matchesFilter(d, filter)) || null),
    find: jest.fn((filter: any) => {
      let rows = store.filter((d) => matchesFilter(d, filter));
      const chain: any = {
        sort: (sortSpec: any) => {
          const keys = Object.keys(sortSpec);
          rows = [...rows].sort((a, b) => {
            for (const k of keys) {
              const dir = sortSpec[k];
              if (a[k] === b[k]) continue;
              return a[k] > b[k] ? dir : -dir;
            }
            return 0;
          });
          return chain;
        },
        limit: (n: number) => {
          rows = rows.slice(0, n);
          return chain;
        },
        exec: async () => rows,
      };
      return chain;
    }),
    aggregate: jest.fn(async (pipeline: any[]) => {
      // Minimal aggregate for listConversations
      let docs = [...store];
      for (const stage of pipeline) {
        if (stage.$match) {
          docs = docs.filter((d) => matchesFilter(d, stage.$match));
        }
        if (stage.$sort) {
          const keys = Object.keys(stage.$sort);
          docs.sort((a, b) => {
            for (const k of keys) {
              const dir = stage.$sort[k];
              const path = k.includes('.') ? k.split('.') : [k];
              const av = path.reduce((o: any, p: string) => o?.[p], a);
              const bv = path.reduce((o: any, p: string) => o?.[p], b);
              if (av === bv) continue;
              return av > bv ? dir : -dir;
            }
            return 0;
          });
        }
        if (stage.$group) {
          const map = new Map<string, any>();
          for (const d of docs) {
            const key = String(d.fromNumber);
            if (!map.has(key)) {
              map.set(key, {
                _id: key,
                lastMessage: d,
                unreadCount: !d.fromMe && d.unread ? 1 : 0,
              });
            } else {
              const g = map.get(key);
              if (!d.fromMe && d.unread) g.unreadCount += 1;
            }
          }
          docs = [...map.values()] as any;
        }
        if (stage.$limit) {
          docs = docs.slice(0, stage.$limit);
        }
      }
      return docs;
    }),
    updateMany: jest.fn(async (filter: any, update: any) => {
      for (const d of store) {
        if (matchesFilter(d, filter)) Object.assign(d, update.$set || {});
      }
      return { modifiedCount: 1 };
    }),
    deleteOne: jest.fn(async (filter: any) => {
      const idx = store.findIndex((d) => matchesFilter(d, filter));
      if (idx >= 0) store.splice(idx, 1);
      return { deletedCount: idx >= 0 ? 1 : 0 };
    }),
    countDocuments: jest.fn(async (filter: any = {}) => store.filter((d) => matchesFilter(d, filter)).length),
  };
  return { __esModule: true, default: api };
});

jest.mock('../../models/prismaClient', () => ({
  __esModule: true,
  default: {
    whatsAppInstance: { findFirst: jest.fn() },
    contact: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

const mockSendMessage = jest.fn();

class FakeTransport extends EventEmitter {
  connectionState: string;
  constructor(private userId: number, state: string = WaConnectionState.OPEN) {
    super();
    this.connectionState = state;
  }
  getUserId() {
    return this.userId;
  }
  getStatus() {
    return { state: this.connectionState, lastUpdated: new Date() };
  }
  sendMessage = mockSendMessage;
}

const fakeA = new FakeTransport(1);
const fakeB = new FakeTransport(2);

jest.mock('../WhatsAppInstanceManager', () => ({
  __esModule: true,
  default: {
    getInstance: (id: number) => {
      if (id === 10) return fakeA;
      if (id === 20) return fakeB;
      return undefined;
    },
  },
}));

import prisma from '../../models/prismaClient';
import ChatMessage from '../../models/ChatMessage';

describe('ChatService (fake WhatsApp transport)', () => {
  const chatService = new ChatService();

  beforeEach(() => {
    store.length = 0;
    mockSendMessage.mockReset();
    mockSendMessage.mockResolvedValue('wa-msg-1');
    fakeA.connectionState = WaConnectionState.OPEN;
    (prisma.whatsAppInstance.findFirst as jest.Mock).mockImplementation(async ({ where }) => {
      if (where.id === 10 && where.userId === 1) return { id: 10, userId: 1 };
      if (where.id === 20 && where.userId === 2) return { id: 20, userId: 2 };
      return null;
    });
    (prisma.contact.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.contact.create as jest.Mock).mockResolvedValue({});
    (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
  });

  it('persists inbound and lists conversation for owner only', async () => {
    await chatService.persistInbound(1, {
      instanceId: 10,
      messageId: 'in-1',
      fromNumber: '5511999990001',
      text: 'Olá',
      timestamp: Date.now(),
    });

    const pageA = await chatService.listConversations(1, { limit: 10 });
    const pageB = await chatService.listConversations(2, { limit: 10 });

    expect(pageA.items).toHaveLength(1);
    expect(pageA.items[0].contactPhone).toBe('5511999990001');
    expect(pageA.items[0].unreadCount).toBe(1);
    expect(pageB.items).toHaveLength(0);
  });

  it('blocks user B from reading user A messages via instance ownership', async () => {
    await chatService.persistInbound(1, {
      instanceId: 10,
      messageId: 'in-2',
      fromNumber: '5511888880002',
      text: 'segredo',
      timestamp: Date.now(),
    });

    await expect(chatService.listMessages(2, 10, '5511888880002')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('blocks user B from sending via user A instance', async () => {
    await expect(
      chatService.sendText({
        userId: 2,
        instanceId: 10,
        phoneNumber: '5511999990001',
        message: 'hack',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('send lifecycle PENDING→SENT and idempotent clientMessageId', async () => {
    const first = await chatService.sendText({
      userId: 1,
      instanceId: 10,
      phoneNumber: '5511999990001',
      message: 'oi',
      clientMessageId: 'client-abc',
    });
    expect(first.status).toBe('SENT');
    expect(mockSendMessage).toHaveBeenCalledTimes(1);

    const second = await chatService.sendText({
      userId: 1,
      instanceId: 10,
      phoneNumber: '5511999990001',
      message: 'oi',
      clientMessageId: 'client-abc',
    });
    expect(second.messageId).toBe(first.messageId);
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });

  it('blocks send when channel disconnected', async () => {
    fakeA.connectionState = WaConnectionState.CLOSE;
    await expect(
      chatService.sendText({
        userId: 1,
        instanceId: 10,
        phoneNumber: '5511999990001',
        message: 'oi',
      })
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it('marks FAILED then retries without creating duplicate clientMessageId', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('transport down'));
    await expect(
      chatService.sendText({
        userId: 1,
        instanceId: 10,
        phoneNumber: '5511999990001',
        message: 'retry-me',
        clientMessageId: 'client-retry',
      })
    ).rejects.toMatchObject({ statusCode: 502 });

    const failed = await (ChatMessage.findOne as jest.Mock)({ clientMessageId: 'client-retry' });
    expect(failed?.status).toBe('FAILED');

    mockSendMessage.mockResolvedValueOnce('wa-retry-ok');
    const resent = await chatService.sendText({
      userId: 1,
      instanceId: 10,
      phoneNumber: '5511999990001',
      message: 'retry-me',
      clientMessageId: 'client-retry',
    });
    expect(resent.status).toBe('SENT');
    expect(await (ChatMessage.countDocuments as jest.Mock)({ clientMessageId: 'client-retry' })).toBe(1);
  });

  it('paginates messages with cursor and supports BR phone variants', async () => {
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await ChatMessage.create({
        userId: 1,
        instanceId: 10,
        fromNumber: '5511999990001',
        text: `m${i}`,
        fromMe: false,
        timestamp: base + i,
        messageId: `msg-${i}`,
        status: 'DELIVERED',
        unread: true,
      });
    }

    const page1 = await chatService.listMessages(1, 10, '5511999990001', { limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await chatService.listMessages(1, 10, '5511999990001', {
      limit: 2,
      cursor: page1.nextCursor!,
    });
    expect(page2.items).toHaveLength(2);
    const ids = new Set([...page1.items, ...page2.items].map((m) => m.messageId));
    expect(ids.size).toBe(4);

    const viaVariant = await chatService.listMessages(1, 10, '551199990001', { limit: 10 });
    expect(viaVariant.items.length).toBeGreaterThanOrEqual(4);
  });

  it('updates delivery/read status monotonically', async () => {
    await ChatMessage.create({
      userId: 1,
      instanceId: 10,
      fromNumber: '5511999990001',
      text: 'x',
      fromMe: true,
      timestamp: Date.now(),
      messageId: 'out-1',
      status: 'SENT',
      unread: false,
    });

    await chatService.updateStatusByMessageId('out-1', 'delivered');
    let doc = await (ChatMessage.findOne as jest.Mock)({ messageId: 'out-1' });
    expect(doc?.status).toBe('DELIVERED');

    await chatService.updateStatusByMessageId('out-1', 'read');
    doc = await (ChatMessage.findOne as jest.Mock)({ messageId: 'out-1' });
    expect(doc?.status).toBe('READ');

    await chatService.updateStatusByMessageId('out-1', 'delivered');
    doc = await (ChatMessage.findOne as jest.Mock)({ messageId: 'out-1' });
    expect(doc?.status).toBe('READ');
  });
});
