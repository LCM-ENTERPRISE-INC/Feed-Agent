import { WarmupCacheService } from './WarmupCacheService';
import { WarmupProfileService } from './WarmupProfileService';
import { WarmupStatus } from '@prisma/client';
import { warmupLogger } from '../utils/warmupLogger';

const MAX_FAILURES = 3;

export class WarmupBackoffService {
  /**
   * Registers a failure for the specified instance.
   * If the failure threshold is reached, it pauses the instance to protect it.
   */
  static async registerFailure(instanceId: string): Promise<number> {
    const failures = await WarmupCacheService.incrementFailures(instanceId);
    
    warmupLogger.warn(`[WarmupBackoffService] Instance ${instanceId} experienced a failure. Consecutive failures: ${failures}`);

    if (failures >= MAX_FAILURES) {
      warmupLogger.error(`[WarmupBackoffService] Threshold reached for instance ${instanceId}. Applying EMERGENCY PAUSE.`);
      
      // Suspend operations permanently until user review
      await WarmupProfileService.updateStatus(
        instanceId, 
        WarmupStatus.PAUSED, 
        `Safety Backoff triggered (${failures} consecutive failures)`
      );
      
      // Optionally reset failures after pausing so that if user resumes it starts fresh
      await WarmupCacheService.resetFailures(instanceId);
    }

    return failures;
  }

  /**
   * Clears the failure record upon a successful interaction.
   */
  static async registerSuccess(instanceId: string): Promise<void> {
    await WarmupCacheService.resetFailures(instanceId);
  }
}
