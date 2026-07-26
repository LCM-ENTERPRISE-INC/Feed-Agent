"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupJitterService = void 0;
const client_1 = require("@prisma/client");
class WarmupJitterService {
    /**
     * Generates a random delay (jitter) between a min and max value (inclusive).
     */
    static calculateDelay(minMs, maxMs) {
        if (minMs >= maxMs)
            return maxMs;
        return Math.floor(Math.random() * (maxMs - minMs + 1) + minMs);
    }
    /**
     * Computes the exact millisecond delay required before the next message
     * based on the severity, limits of the current phase, and backoff history.
     */
    static getDelayForPhase(phase, failureCount = 0, dailyLimit = 50) {
        let delay = 0;
        switch (phase) {
            case client_1.WarmupPhase.PHASE_1:
                // PHASE 1: Highly restrictive. 2 to 6 minutes.
                delay = this.calculateDelay(2 * 60 * 1000, 6 * 60 * 1000);
                break;
            case client_1.WarmupPhase.PHASE_2:
                // PHASE 2: Moderate. 1 to 3 minutes.
                delay = this.calculateDelay(1 * 60 * 1000, 3 * 60 * 1000);
                break;
            case client_1.WarmupPhase.PHASE_3:
                // PHASE 3: Accelerated. 
                if (dailyLimit >= 1000) {
                    // Alta escala: 15s to 45s
                    delay = this.calculateDelay(15 * 1000, 45 * 1000);
                }
                else {
                    // Normal Phase 3: 30s to 1 minute
                    delay = this.calculateDelay(30 * 1000, 60 * 1000);
                }
                break;
            default:
                // Fallback for IDLE or undefined (treat as Phase 1 for maximum safety)
                delay = this.calculateDelay(2 * 60 * 1000, 6 * 60 * 1000);
                break;
        }
        // Apply Backoff Multiplier
        if (failureCount === 1) {
            delay = delay * 1.5; // 50% slower
        }
        else if (failureCount >= 2) {
            delay = delay * 2.0; // 100% slower
        }
        return Math.floor(delay);
    }
}
exports.WarmupJitterService = WarmupJitterService;
