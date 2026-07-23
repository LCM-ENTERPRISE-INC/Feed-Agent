import { WarmupBackoffService } from '../services/WarmupBackoffService';
import { WarmupCacheService } from '../services/WarmupCacheService';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupStatus, WarmupPhase } from '@prisma/client';
import { WarmupJitterService } from '../services/WarmupJitterService';

jest.mock('../services/WarmupCacheService', () => ({
  WarmupCacheService: {
    incrementFailures: jest.fn(),
    resetFailures: jest.fn(),
  }
}));

jest.mock('../services/WarmupProfileService', () => ({
  WarmupProfileService: {
    updateStatus: jest.fn().mockResolvedValue(undefined),
  }
}));

describe('WarmupBackoffService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register a failure and NOT pause if under threshold', async () => {
    (WarmupCacheService.incrementFailures as jest.Mock).mockResolvedValue(1);

    const failures = await WarmupBackoffService.registerFailure('inst1');
    
    expect(failures).toBe(1);
    expect(WarmupProfileService.updateStatus).not.toHaveBeenCalled();
  });

  it('should pause the instance if failures reach the threshold (3)', async () => {
    (WarmupCacheService.incrementFailures as jest.Mock).mockResolvedValue(3);

    const failures = await WarmupBackoffService.registerFailure('inst2');
    
    expect(failures).toBe(3);
    expect(WarmupProfileService.updateStatus).toHaveBeenCalledWith(
      'inst2',
      WarmupStatus.PAUSED,
      expect.stringContaining('Safety Backoff triggered')
    );
    expect(WarmupCacheService.resetFailures).toHaveBeenCalledWith('inst2');
  });

  it('should reset failures on success', async () => {
    await WarmupBackoffService.registerSuccess('inst3');
    expect(WarmupCacheService.resetFailures).toHaveBeenCalledWith('inst3');
  });
});

describe('WarmupJitterService with Backoff', () => {
  it('should increase delay by 1.5x on 1 failure', () => {
    // Force a specific calculation for predictable math
    jest.spyOn(WarmupJitterService, 'calculateDelay').mockReturnValue(1000);
    
    const delay = WarmupJitterService.getDelayForPhase(WarmupPhase.PHASE_3, 1);
    
    expect(WarmupJitterService.calculateDelay).toHaveBeenCalled();
    expect(delay).toBe(1500); // 1000 * 1.5
  });

  it('should increase delay by 2x on 2 or more failures', () => {
    jest.spyOn(WarmupJitterService, 'calculateDelay').mockReturnValue(1000);
    
    const delay2 = WarmupJitterService.getDelayForPhase(WarmupPhase.PHASE_3, 2);
    expect(delay2).toBe(2000); // 1000 * 2
    
    const delay3 = WarmupJitterService.getDelayForPhase(WarmupPhase.PHASE_3, 5);
    expect(delay3).toBe(2000); // 1000 * 2 (max penalty factor is 2.0x)
  });
});
