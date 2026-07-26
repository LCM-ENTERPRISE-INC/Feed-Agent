"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupAuditService = void 0;
const WarmupHistoryLog_1 = require("../../models/WarmupHistoryLog");
const warmupLogger_1 = require("../utils/warmupLogger");
class WarmupAuditService {
    /**
     * Logs an interaction (message sent/received) into MongoDB asynchronously.
     * Fire-and-forget: it catches its own errors so the main flow is never blocked.
     */
    static logInteraction(data) {
        // We do not await this, it's fire-and-forget
        Promise.resolve().then(async () => {
            try {
                const doc = new WarmupHistoryLog_1.WarmupHistoryLog(data);
                await doc.save();
                warmupLogger_1.warmupLogger.debug(`[WarmupAudit] Logged ${data.direction} interaction for instance ${data.instanceId} to DB.`);
            }
            catch (err) {
                warmupLogger_1.warmupLogger.error(`[WarmupAudit] Failed to log interaction to MongoDB for instance ${data.instanceId}:`, err);
            }
        });
    }
}
exports.WarmupAuditService = WarmupAuditService;
