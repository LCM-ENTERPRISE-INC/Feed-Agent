import { WarmupMetricsService } from '../services/WarmupMetricsService';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupCacheService } from '../services/WarmupCacheService';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import { Boom } from '@hapi/boom';
import { WarmupStatus, WarmupPhase } from '@prisma/client';

jest.mock('../services/WarmupProfileService', () => ({
  WarmupProfileService: {
    getProfile: jest.fn(),
  }
}));

jest.mock('../services/WarmupCacheService', () => ({
  WarmupCacheService: {
    getState: jest.fn(),
  }
}));

jest.mock('../../services/WhatsAppInstanceManager', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(),
  }
}));

describe('WarmupMetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should consolidate and return correct metrics for an active instance', async () => {
    // 1. Mock DB
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValueOnce({
      status: WarmupStatus.IDLE,
      currentPhase: WarmupPhase.PHASE_1,
      dailyLimit: 10,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
    });

    // 2. Mock Redis
    (WarmupCacheService.getState as jest.Mock).mockResolvedValueOnce({
      isPaused: false,
      messagesSentInCurrentBatch: 5,
      lastActionTimestamp: 123456789,
    });

    // 3. Mock Socket
    (whatsAppInstanceManager.getInstance as jest.Mock).mockReturnValueOnce({
      getSocket: () => ({}) // Fake connected socket
    });

    const metrics = await WarmupMetricsService.getInstanceMetrics('1');

    expect(metrics).toEqual({
      instanceId: 1,
      isSocketConnected: true,
      status: 'IDLE',
      currentPhase: 'PHASE_1',
      dailyLimit: 10,
      messagesSentInCurrentBatch: 5,
      isVolatilePaused: false,
      lastActionTimestamp: 123456789,
      uptimeHours: 2,
    });
  });

  it('should throw 404 if profile does not exist', async () => {
    (WarmupProfileService.getProfile as jest.Mock).mockRejectedValueOnce(new Boom('Not found', { statusCode: 404 }));

    await expect(WarmupMetricsService.getInstanceMetrics('99')).rejects.toThrow('Cannot fetch metrics. Warmup profile for instance 99 does not exist.');
  });
});
