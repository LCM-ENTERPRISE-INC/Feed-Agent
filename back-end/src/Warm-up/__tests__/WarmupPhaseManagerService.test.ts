import { PrismaClient, WarmupStatus, WarmupPhase, WarmupProfile } from '@prisma/client';
import { WarmupPhaseManagerService } from '../services/WarmupPhaseManagerService';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupCacheService } from '../services/WarmupCacheService';

jest.mock('@prisma/client', () => {
  const mPrisma = {
    warmupProfile: {
      findMany: jest.fn(),
      update: jest.fn()
    },
    warmupStatusHistory: {
      findMany: jest.fn()
    }
  };
  return {
    PrismaClient: jest.fn(() => mPrisma),
    WarmupStatus: {
      IDLE: 'IDLE',
      WARMING: 'WARMING',
      COMPLETED: 'COMPLETED',
      PAUSED: 'PAUSED',
      COOLING_DOWN: 'COOLING_DOWN'
    },
    WarmupPhase: {
      PHASE_1: 'PHASE_1',
      PHASE_2: 'PHASE_2',
      PHASE_3: 'PHASE_3'
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

jest.mock('../services/WarmupProfileService', () => ({
  WarmupProfileService: {
    updateStatus: jest.fn()
  }
}));

jest.mock('../services/WarmupCacheService', () => ({
  WarmupCacheService: {
    getState: jest.fn().mockResolvedValue({ messagesSentInCurrentBatch: 10, messagesReceivedInCurrentBatch: 5 }),
    setState: jest.fn()
  }
}));

const prisma = new PrismaClient() as any;

describe('WarmupPhaseManagerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockProfile = (daysOld: number): WarmupProfile => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysOld);
    
    return {
      id: 1,
      instanceId: 101,
      name: 'Test Profile',
      currentPhase: 'PHASE_1' as WarmupPhase,
      status: 'WARMING' as WarmupStatus,
      dailyLimit: 10,
      messagesSentToday: 5,
      startDate: startDate,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  };

  it('should evaluate all WARMING profiles', async () => {
    prisma.warmupProfile.findMany.mockResolvedValue([createMockProfile(2)]);
    prisma.warmupStatusHistory.findMany.mockResolvedValue([]);
    
    await WarmupPhaseManagerService.evaluateAllProfiles();

    expect(prisma.warmupProfile.findMany).toHaveBeenCalledWith({
      where: { status: 'WARMING' }
    });
    expect(prisma.warmupProfile.update).toHaveBeenCalled();
  });

  describe('evaluateProfile', () => {
    beforeEach(() => {
      prisma.warmupStatusHistory.findMany.mockResolvedValue([]);
    });

    it('should keep Phase 1 with limit 10 for day 1-3', async () => {
      const profile = createMockProfile(2); // Day 3
      await WarmupPhaseManagerService.evaluateProfile(profile);

      expect(prisma.warmupProfile.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentPhase: 'PHASE_1',
          dailyLimit: 10,
          messagesSentToday: 0
        }
      });
      expect(WarmupCacheService.setState).toHaveBeenCalled();
    });

    it('should increase limit to 25 for day 4-7', async () => {
      const profile = createMockProfile(4); // Day 5
      await WarmupPhaseManagerService.evaluateProfile(profile);

      expect(prisma.warmupProfile.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentPhase: 'PHASE_1',
          dailyLimit: 25,
          messagesSentToday: 0
        }
      });
    });

    it('should transition to Phase 2 with limit 75 for day 8-10', async () => {
      const profile = createMockProfile(8); // Day 9
      await WarmupPhaseManagerService.evaluateProfile(profile);

      expect(prisma.warmupProfile.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentPhase: 'PHASE_2',
          dailyLimit: 75,
          messagesSentToday: 0
        }
      });
    });

    it('should transition to Phase 2 with limit 200 for day 11-14', async () => {
      const profile = createMockProfile(11); // Day 12
      await WarmupPhaseManagerService.evaluateProfile(profile);

      expect(prisma.warmupProfile.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentPhase: 'PHASE_2',
          dailyLimit: 200,
          messagesSentToday: 0
        }
      });
    });

    it('should transition to Phase 3 with limit 450 for day 15-17', async () => {
      const profile = createMockProfile(15); // Day 16
      await WarmupPhaseManagerService.evaluateProfile(profile);

      expect(prisma.warmupProfile.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentPhase: 'PHASE_3',
          dailyLimit: 450,
          messagesSentToday: 0
        }
      });
    });

    it('should transition to Phase 3 with limit 800 for day 18-21', async () => {
      const profile = createMockProfile(20); // Day 21
      await WarmupPhaseManagerService.evaluateProfile(profile);

      expect(prisma.warmupProfile.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentPhase: 'PHASE_3',
          dailyLimit: 800,
          messagesSentToday: 0
        }
      });
    });

    it('should transition to COMPLETED for day 22+', async () => {
      const profile = createMockProfile(22); // Day 23
      await WarmupPhaseManagerService.evaluateProfile(profile);

      // Should not update limits anymore, but should call updateStatus
      expect(prisma.warmupProfile.update).not.toHaveBeenCalled();
      expect(WarmupProfileService.updateStatus).toHaveBeenCalledWith(
        '101', 
        'COMPLETED', 
        expect.stringContaining('Effective age reached')
      );
    });

    it('should penalize age by 3 days for every PAUSED status', async () => {
      const profile = createMockProfile(15); // Chronological Day 16
      
      // Add two PAUSED events in history
      prisma.warmupStatusHistory.findMany.mockResolvedValue([
        { newStatus: 'PAUSED' },
        { newStatus: 'PAUSED' }
      ]);
      
      // Chronological: 16 days. Penalty: 6 days. Effective: 10 days.
      // Effective 10 days = Phase 2, limit 75.
      await WarmupPhaseManagerService.evaluateProfile(profile);

      expect(prisma.warmupProfile.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          currentPhase: 'PHASE_2',
          dailyLimit: 75,
          messagesSentToday: 0
        }
      });
    });
  });
});
