import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupCacheService } from '../services/WarmupCacheService';
import { PrismaClient, WarmupStatus, WarmupPhase } from '@prisma/client';

// Mock the Prisma client
jest.mock('@prisma/client', () => {
  const mPrisma: any = {
    whatsAppInstance: { findUnique: jest.fn() },
    warmupProfile: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    warmupStatusHistory: { create: jest.fn() },
  };
  mPrisma.$transaction = jest.fn((callback: any) => callback(mPrisma));
  
  return {
    PrismaClient: jest.fn(() => mPrisma),
    WarmupStatus: { IDLE: 'IDLE', PAUSED: 'PAUSED', COMPLETED: 'COMPLETED', BANNED: 'BANNED' },
    WarmupPhase: { PHASE_1: 'PHASE_1' }
  };
});

jest.mock('../services/WarmupCacheService', () => ({
  WarmupCacheService: {
    setState: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn().mockResolvedValue({ isPaused: false }),
    deleteState: jest.fn().mockResolvedValue(undefined),
  }
}));

describe('WarmupProfileService', () => {
  let prismaMock: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock = new PrismaClient();
  });

  describe('startWarmup', () => {
    it('should throw an error if WhatsAppInstance does not exist', async () => {
      prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce(null);
      
      await expect(WarmupProfileService.startWarmup({ instanceId: '1', name: 'Test' }))
        .rejects.toThrow('WhatsApp Instance not found');
    });

    it('should create a new warmup profile and history', async () => {
      prismaMock.whatsAppInstance.findUnique.mockResolvedValueOnce({ id: 1 });
      prismaMock.warmupProfile.findUnique.mockResolvedValueOnce(null);
      
      const newProfile = { id: 10, instanceId: 1, status: WarmupStatus.IDLE };
      prismaMock.warmupProfile.create.mockResolvedValueOnce(newProfile);

      const result = await WarmupProfileService.startWarmup({ instanceId: '1', name: 'Test' });
      
      expect(prismaMock.warmupProfile.create).toHaveBeenCalled();
      expect(prismaMock.warmupStatusHistory.create).toHaveBeenCalled();
      expect(WarmupCacheService.setState).toHaveBeenCalledWith('1', expect.any(Object));
      expect(result).toEqual(newProfile);
    });
  });

  describe('updateStatus', () => {
    it('should update status and create history if changed', async () => {
      prismaMock.warmupProfile.findUnique.mockResolvedValueOnce({ id: 10, instanceId: 1, status: WarmupStatus.IDLE });
      prismaMock.warmupProfile.update.mockResolvedValueOnce({ id: 10, instanceId: 1, status: WarmupStatus.PAUSED });

      await WarmupProfileService.updateStatus('1', WarmupStatus.PAUSED, 'Manual Pause');

      expect(prismaMock.warmupProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: WarmupStatus.PAUSED } })
      );
      expect(prismaMock.warmupStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ newStatus: WarmupStatus.PAUSED }) })
      );
      expect(WarmupCacheService.setState).toHaveBeenCalled(); // Since it is paused
    });
  });
});
