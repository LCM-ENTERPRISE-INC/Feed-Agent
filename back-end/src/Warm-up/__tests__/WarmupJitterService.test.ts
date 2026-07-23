import { WarmupJitterService } from '../services/WarmupJitterService';
import { WarmupPhase } from '@prisma/client';

describe('WarmupJitterService', () => {
  it('calculateDelay should return values within bounds', () => {
    const min = 1000;
    const max = 2000;
    
    // Test 50 times to ensure boundaries are respected
    for (let i = 0; i < 50; i++) {
      const delay = WarmupJitterService.calculateDelay(min, max);
      expect(delay).toBeGreaterThanOrEqual(min);
      expect(delay).toBeLessThanOrEqual(max);
    }
  });

  it('calculateDelay should handle min >= max safely', () => {
    expect(WarmupJitterService.calculateDelay(3000, 2000)).toBe(2000);
    expect(WarmupJitterService.calculateDelay(1000, 1000)).toBe(1000);
  });

  it('getDelayForPhase should return appropriate delays for PHASE_1', () => {
    const delay = WarmupJitterService.getDelayForPhase(WarmupPhase.PHASE_1);
    expect(delay).toBeGreaterThanOrEqual(2 * 60 * 1000);
    expect(delay).toBeLessThanOrEqual(6 * 60 * 1000);
  });

  it('getDelayForPhase should return appropriate delays for PHASE_2', () => {
    const delay = WarmupJitterService.getDelayForPhase(WarmupPhase.PHASE_2);
    expect(delay).toBeGreaterThanOrEqual(1 * 60 * 1000);
    expect(delay).toBeLessThanOrEqual(3 * 60 * 1000);
  });

  it('getDelayForPhase should return appropriate delays for PHASE_3 (normal scale)', () => {
    const delay = WarmupJitterService.getDelayForPhase(WarmupPhase.PHASE_3, 0, 500);
    expect(delay).toBeGreaterThanOrEqual(30 * 1000);
    expect(delay).toBeLessThanOrEqual(60 * 1000);
  });

  it('getDelayForPhase should return ultra-low delays for PHASE_3 (high scale)', () => {
    const delay = WarmupJitterService.getDelayForPhase(WarmupPhase.PHASE_3, 0, 1000);
    expect(delay).toBeGreaterThanOrEqual(15 * 1000);
    expect(delay).toBeLessThanOrEqual(45 * 1000);
  });
});
