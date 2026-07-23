import { WarmupQueue, WarmupMessageJob } from '../queues/WarmupQueue';
import { WarmupBaileysService } from '../services/WarmupBaileysService';
import { WarmupCacheService } from '../services/WarmupCacheService';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import { Boom } from '@hapi/boom';
import IORedis from 'ioredis';

// Mock dependencies
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn(),
    status: 'ready'
  }));
});

jest.mock('bullmq', () => {
  const originalModule = jest.requireActual('bullmq');
  return {
    ...originalModule,
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    })),
    Worker: jest.fn().mockImplementation((name, processor, opts) => {
      // Expose the processor to tests so we can call it directly
      (global as any).mockWorkerProcessor = processor;
      return {
        on: jest.fn(),
        close: jest.fn(),
      };
    }),
  };
});

jest.mock('../services/WarmupBaileysService', () => ({
  WarmupBaileysService: {
    sendWarmupMessage: jest.fn().mockResolvedValue(undefined),
  }
}));

jest.mock('../services/WarmupCacheService', () => ({
  WarmupCacheService: {
    incrementMessagesSent: jest.fn().mockResolvedValue(undefined),
  }
}));

jest.mock('../../services/WhatsAppInstanceManager', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  }
}));

describe('WarmupQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize worker', () => {
    expect(() => WarmupQueue.initWorker()).not.toThrow();
  });

  it('should add a message job to the queue', async () => {
    const jobData: WarmupMessageJob = {
      instanceId: '1',
      targetJid: '551199999999@s.whatsapp.net',
      messageType: 'text',
      content: 'Hello'
    };

    const job = await WarmupQueue.addMessageJob(jobData);
    expect(job).toBeDefined();
    expect(job.id).toBe('mock-job-id');
  });

  it('worker processor should process text job successfully', async () => {
    WarmupQueue.initWorker();
    const processor = (global as any).mockWorkerProcessor;

    (whatsAppInstanceManager.getInstance as jest.Mock).mockReturnValue({
      getSocket: () => ({ fakeSocket: true })
    });

    const mockJob = {
      id: 'job-123',
      data: {
        instanceId: '1',
        targetJid: 'test@s.whatsapp.net',
        messageType: 'text',
        content: 'ping'
      }
    };

    await processor(mockJob);

    expect(WarmupBaileysService.sendWarmupMessage).toHaveBeenCalledWith(
      { fakeSocket: true },
      'test@s.whatsapp.net',
      'ping'
    );
    expect(WarmupCacheService.incrementMessagesSent).toHaveBeenCalledWith('1');
  });

  it('worker processor should throw Boom error if socket is not connected', async () => {
    WarmupQueue.initWorker();
    const processor = (global as any).mockWorkerProcessor;

    (whatsAppInstanceManager.getInstance as jest.Mock).mockReturnValue({
      getSocket: () => null // simulate disconnected
    });

    const mockJob = {
      id: 'job-disconnected',
      data: { instanceId: '1', targetJid: 'test@s.whatsapp.net', messageType: 'text', content: 'ping' }
    };

    await expect(processor(mockJob)).rejects.toThrow(Boom);
  });
});
