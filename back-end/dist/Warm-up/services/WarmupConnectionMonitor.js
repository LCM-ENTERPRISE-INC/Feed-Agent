"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupConnectionMonitor = void 0;
const WarmupProfileService_1 = require("./WarmupProfileService");
const client_1 = require("@prisma/client");
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupAlertService_1 = require("./WarmupAlertService");
const boom_1 = require("@hapi/boom");
class WarmupConnectionMonitor {
    /**
     * Attaches listeners to a WhatsAppService instance to monitor its connection state
     * and automatically pause/resume the Warmup process to avoid bans during network drops.
     */
    static attachMonitor(service, instanceId) {
        const instanceIdStr = String(instanceId);
        // Using any to bypass strict type checking if WhatsAppService doesn't explicitly type these events
        const emitter = service;
        // Triggered when the socket is closed/disconnected
        emitter.on('close', async (reason) => {
            warmupLogger_1.warmupLogger.warn(`[WarmupConnectionMonitor] Connection closed for instance ${instanceId}. Reason: ${reason}`);
            const reasonStr = reason || '';
            if (reasonStr.includes('401') || reasonStr.includes('403') || reasonStr.includes('405')) {
                await WarmupAlertService_1.WarmupAlertService.sendCriticalAlert(instanceIdStr, `Critical Disconnect Reason: ${reasonStr}`, 'CRITICAL');
            }
            try {
                // We pause the warmup to prevent BullMQ from accumulating messages and blasting them on reconnect
                await WarmupProfileService_1.WarmupProfileService.updateStatus(instanceIdStr, client_1.WarmupStatus.PAUSED, `Connection Dropped. Reason: ${reason || 'Unknown'}`);
            }
            catch (err) {
                if (err instanceof boom_1.Boom && err.output.statusCode === 404) {
                    // Warmup profile doesn't exist for this instance, safely ignore
                    return;
                }
                warmupLogger_1.warmupLogger.error(`[WarmupConnectionMonitor] Failed to auto-pause warmup for instance ${instanceId}`, err);
            }
        });
        // Triggered when the socket successfully reconnects
        emitter.on('open', async () => {
            warmupLogger_1.warmupLogger.info(`[WarmupConnectionMonitor] Connection opened for instance ${instanceId}. Checking if auto-resume is needed.`);
            try {
                const profile = await WarmupProfileService_1.WarmupProfileService.getProfile(instanceIdStr);
                // We only auto-resume if it was paused. If it's IDLE, WARMING, COMPLETED or BANNED, we leave it alone.
                // Furthermore, we could check the last history log to see if it was paused specifically by the Monitor.
                if (profile.status === client_1.WarmupStatus.PAUSED) {
                    const lastLog = profile.statusHistory[0];
                    if (lastLog && lastLog.reason?.includes('Connection Dropped')) {
                        await WarmupProfileService_1.WarmupProfileService.updateStatus(instanceIdStr, client_1.WarmupStatus.IDLE, // Switch to IDLE, the rule engine will pick it up and change to WARMING
                        'Auto-resumed after connection restored');
                    }
                }
            }
            catch (err) {
                if (err instanceof boom_1.Boom && err.output.statusCode === 404) {
                    // Warmup profile doesn't exist
                    return;
                }
                warmupLogger_1.warmupLogger.error(`[WarmupConnectionMonitor] Failed to auto-resume warmup for instance ${instanceId}`, err);
            }
        });
        warmupLogger_1.warmupLogger.info(`[WarmupConnectionMonitor] Attached listeners to instance ${instanceId}`);
    }
}
exports.WarmupConnectionMonitor = WarmupConnectionMonitor;
