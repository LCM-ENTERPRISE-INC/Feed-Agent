import { PrismaClient, WarmupStatus } from '@prisma/client';
import { WarmupCrossTalkService } from '../services/WarmupCrossTalkService';
import { WarmupQueue } from '../queues/WarmupQueue';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';

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
    addSeedMessageJob: jest.fn().mockResolvedValue({})
  }
}));

jest.mock('../../services/WhatsAppInstanceManager', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn()
  }
}));

const prisma = new PrismaClient() as any;

describe('WarmupCrossTalkService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not schedule cross-talks if there are less than 2 profiles globally', async () => {
    prisma.warmupProfile.findMany.mockResolvedValue([
      { instance: { userId: 1 }, instanceId: 10 }
    ]);

    await WarmupCrossTalkService.scheduleCrossTalks();

    expect(WarmupQueue.addSeedMessageJob).not.toHaveBeenCalled();
  });

  it('should not schedule cross-talks if profiles belong to different users', async () => {
    prisma.warmupProfile.findMany.mockResolvedValue([
      { instance: { userId: 1 }, instanceId: 10 },
      { instance: { userId: 2 }, instanceId: 20 }
    ]);

    await WarmupCrossTalkService.scheduleCrossTalks();

    expect(WarmupQueue.addSeedMessageJob).not.toHaveBeenCalled();
  });

  it('should schedule cross-talks for profiles belonging to the same user', async () => {
    prisma.warmupProfile.findMany.mockResolvedValue([
      { instance: { userId: 1 }, instanceId: 10 },
      { instance: { userId: 1 }, instanceId: 20 }
    ]);

    (whatsAppInstanceManager.getInstance as jest.Mock).mockImplementation((id) => {
      return {
        getSocket: () => ({
          user: { id: `55119999999${id}@s.whatsapp.net` }
        })
      };
    });

    await WarmupCrossTalkService.scheduleCrossTalks();

    expect(WarmupQueue.addSeedMessageJob).toHaveBeenCalledTimes(2);
    
    // Check if jobs target the right phones
    const calls = (WarmupQueue.addSeedMessageJob as jest.Mock).mock.calls;
    
    // Extract instance IDs that initiated the call
    const initiators = calls.map(c => c[0].instanceId);
    expect(initiators).toContain('10');
    expect(initiators).toContain('20');
  });

  it('should skip targeting if JID is not available', async () => {
    prisma.warmupProfile.findMany.mockResolvedValue([
      { instance: { userId: 1 }, instanceId: 10 },
      { instance: { userId: 1 }, instanceId: 20 }
    ]);

    (whatsAppInstanceManager.getInstance as jest.Mock).mockImplementation(() => {
      return {
        getSocket: () => ({
          user: null // No JID
        })
      };
    });

    await WarmupCrossTalkService.scheduleCrossTalks();

    expect(WarmupQueue.addSeedMessageJob).not.toHaveBeenCalled();
  });
});
