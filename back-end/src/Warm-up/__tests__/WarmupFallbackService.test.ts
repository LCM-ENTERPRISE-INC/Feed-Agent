import { PrismaClient, WarmupStatus } from '@prisma/client';
import { WarmupFallbackService } from '../services/WarmupFallbackService';
import { WarmupQueue } from '../queues/WarmupQueue';

jest.mock('@prisma/client', () => {
  const mPrisma = {
    warmupProfile: {
      findMany: jest.fn()
    }
  };
  return {
    PrismaClient: jest.fn(() => mPrisma),
    WarmupStatus: {
      IDLE: 'IDLE',
      WARMING: 'WARMING',
      COMPLETED: 'COMPLETED'
    }
  };
});

jest.mock('../utils/warmupLogger', () => ({
  warmupLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

jest.mock('../queues/WarmupQueue', () => ({
  WarmupQueue: {
    transferJobs: jest.fn().mockResolvedValue(3)
  }
}));

const prisma = new PrismaClient() as any;

describe('WarmupFallbackService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not fallback if no healthy substitute is found', async () => {
    prisma.warmupProfile.findMany.mockResolvedValue([]);

    const result = await WarmupFallbackService.triggerFallback('1');

    expect(result).toBe(false);
    expect(WarmupQueue.transferJobs).not.toHaveBeenCalled();
  });

  it('should select a substitute and transfer jobs successfully', async () => {
    prisma.warmupProfile.findMany.mockResolvedValue([
      { instanceId: 2, messagesSentToday: 5 }, // Selected as healthy
      { instanceId: 3, messagesSentToday: 20 }
    ]);

    const result = await WarmupFallbackService.triggerFallback('1');

    expect(result).toBe(true);
    expect(prisma.warmupProfile.findMany).toHaveBeenCalledWith({
      where: {
        status: 'WARMING',
        instanceId: { not: 1 }
      },
      orderBy: {
        messagesSentToday: 'asc'
      }
    });
    expect(WarmupQueue.transferJobs).toHaveBeenCalledWith('1', '2');
  });

  it('should return false if an error occurs during fallback', async () => {
    prisma.warmupProfile.findMany.mockRejectedValue(new Error('DB Error'));

    const result = await WarmupFallbackService.triggerFallback('1');

    expect(result).toBe(false);
  });
});
