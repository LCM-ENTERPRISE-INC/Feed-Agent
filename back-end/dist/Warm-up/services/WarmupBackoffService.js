"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupBackoffService = void 0;
const WarmupCacheService_1 = require("./WarmupCacheService");
const WarmupProfileService_1 = require("./WarmupProfileService");
const client_1 = require("@prisma/client");
const warmupLogger_1 = require("../utils/warmupLogger");
const MAX_FAILURES = 3;
class WarmupBackoffService {
    /**
     * Registers a failure for the specified instance.
     * If the failure threshold is reached, it pauses the instance to protect it.
     */
    static async registerFailure(instanceId) {
        const failures = await WarmupCacheService_1.WarmupCacheService.incrementFailures(instanceId);
        warmupLogger_1.warmupLogger.warn(`[WarmupBackoffService] Instance ${instanceId} experienced a failure. Consecutive failures: ${failures}`);
        if (failures >= MAX_FAILURES) {
            warmupLogger_1.warmupLogger.error(`[WarmupBackoffService] Threshold reached for instance ${instanceId}. Applying EMERGENCY PAUSE.`);
            // Suspend operations permanently until user review
            await WarmupProfileService_1.WarmupProfileService.updateStatus(instanceId, client_1.WarmupStatus.PAUSED, `Safety Backoff triggered (${failures} consecutive failures)`);
            // Optionally reset failures after pausing so that if user resumes it starts fresh
            await WarmupCacheService_1.WarmupCacheService.resetFailures(instanceId);
        }
        return failures;
    }
    /**
     * Clears the failure record upon a successful interaction.
     */
    static async registerSuccess(instanceId) {
        await WarmupCacheService_1.WarmupCacheService.resetFailures(instanceId);
    }
}
exports.WarmupBackoffService = WarmupBackoffService;
