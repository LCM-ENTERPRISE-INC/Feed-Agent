import { WarmupRateLimiterService } from '../services/WarmupRateLimiterService';
import { WarmupPhase } from '@prisma/client';
import { WarmupCacheService } from '../services/WarmupCacheService';

jest.mock('../services/WarmupCacheService', () => ({
  WarmupCacheService: {
    getState: jest.fn(),
  }
}));

describe('WarmupRateLimiterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return correct base limits for phases', () => {
    expect(WarmupRateLimiterService.getDailyLimitForPhase(WarmupPhase.PHASE_1)).toBe(15);
    expect(WarmupRateLimiterService.getDailyLimitForPhase(WarmupPhase.PHASE_2)).toBe(40);
    expect(WarmupRateLimiterService.getDailyLimitForPhase(WarmupPhase.PHASE_3)).toBe(80);
    expect(WarmupRateLimiterService.getDailyLimitForPhase('UNKNOWN' as WarmupPhase)).toBe(15);
  });

  it('should block sending if sentCount is equal to phase limit (15)', async () => {
    (WarmupCacheService.getState as jest.Mock).mockResolvedValue({
      messagesSentInCurrentBatch: 15
    });

    const allowed = await WarmupRateLimiterService.canSendToday('1', WarmupPhase.PHASE_1);
    expect(allowed).toBe(false);
  });

  it('should allow sending if sentCount is less than phase limit', async () => {
    (WarmupCacheService.getState as jest.Mock).mockResolvedValue({
      messagesSentInCurrentBatch: 39
    });

    const allowed = await WarmupRateLimiterService.canSendToday('2', WarmupPhase.PHASE_2);
    expect(allowed).toBe(true);
  });

  it('should prioritize custom limit over phase limit', async () => {
    (WarmupCacheService.getState as jest.Mock).mockResolvedValue({
      messagesSentInCurrentBatch: 12
    });

    // Phase 3 allows 80, but custom limit is 10. We sent 12. Should block.
    const allowed = await WarmupRateLimiterService.canSendToday('3', WarmupPhase.PHASE_3, 10);
    expect(allowed).toBe(false);
  });

  it('should ignore custom limit if it is 0 and use phase limit', async () => {
    (WarmupCacheService.getState as jest.Mock).mockResolvedValue({
      messagesSentInCurrentBatch: 20
    });

    // Custom limit is 0 (falsy logic in service), Phase 2 allows 40. We sent 20. Should allow.
    const allowed = await WarmupRateLimiterService.canSendToday('4', WarmupPhase.PHASE_2, 0);
    expect(allowed).toBe(true);
  });
});
