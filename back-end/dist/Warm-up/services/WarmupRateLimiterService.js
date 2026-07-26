"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupRateLimiterService = void 0;
const client_1 = require("@prisma/client");
const WarmupCacheService_1 = require("./WarmupCacheService");
const warmupLogger_1 = require("../utils/warmupLogger");
class WarmupRateLimiterService {
    /**
     * Defines the absolute maximum number of messages allowed per day based on Phase.
     */
    static getDailyLimitForPhase(phase) {
        switch (phase) {
            case client_1.WarmupPhase.PHASE_1:
                return 15;
            case client_1.WarmupPhase.PHASE_2:
                return 40;
            case client_1.WarmupPhase.PHASE_3:
                return 80;
            default:
                // Default to lowest limit for safety
                return 15;
        }
    }
    /**
     * Checks if the instance is allowed to send another message today.
     * Compares the sent counter in Redis against the hierarchical limit.
     */
    static async canSendToday(instanceId, phase, customDailyLimit) {
        // 1. Determine Effective Limit
        const phaseLimit = this.getDailyLimitForPhase(phase);
        // Custom limit takes precedence if it exists and is > 0.
        const effectiveLimit = customDailyLimit && customDailyLimit > 0 ? customDailyLimit : phaseLimit;
        // 2. Fetch Sent Count from Cache
        const state = await WarmupCacheService_1.WarmupCacheService.getState(instanceId);
        const sentCount = state ? state.messagesSentInCurrentBatch : 0;
        const allowed = sentCount < effectiveLimit;
        if (!allowed) {
            warmupLogger_1.warmupLogger.warn(`[WarmupRateLimiter] Instance ${instanceId} exceeded daily limit (${sentCount}/${effectiveLimit}). Blocked.`);
        }
        else {
            warmupLogger_1.warmupLogger.info(`[WarmupRateLimiter] Instance ${instanceId} quota check passed: ${sentCount}/${effectiveLimit}`);
        }
        return allowed;
    }
}
exports.WarmupRateLimiterService = WarmupRateLimiterService;
