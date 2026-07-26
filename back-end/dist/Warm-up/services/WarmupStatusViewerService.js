"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupStatusViewerService = void 0;
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupProfileService_1 = require("./WarmupProfileService");
const WarmupQueue_1 = require("../queues/WarmupQueue");
const client_1 = require("@prisma/client");
class WarmupStatusViewerService {
    /**
     * Evaluates an incoming status broadcast and decides whether to "view" it (send read receipt).
     * Implements a 70% probability check and queues the view action with a random Jitter.
     */
    static async handleIncomingStatus(instanceId, msg, _client) {
        try {
            if (!msg.id)
                return;
            // 1. Verify if this instance is actively warming up
            const profile = await WarmupProfileService_1.WarmupProfileService.getProfile(instanceId);
            if (!profile || profile.status !== client_1.WarmupStatus.WARMING) {
                return; // Ignore if not in active warmup
            }
            // 2. Probability Check (70% chance to view)
            const shouldView = Math.random() <= 0.7;
            if (!shouldView) {
                warmupLogger_1.warmupLogger.info(`[WarmupStatusViewer] Ignored status from ${msg.author || msg.from} for instance ${instanceId} (simulating human ignoring)`);
                return;
            }
            // 3. Jitter: Delay between 30 seconds and 15 minutes
            const delayMs = Math.floor(Math.random() * (15 * 60 * 1000 - 30 * 1000)) + 30 * 1000;
            warmupLogger_1.warmupLogger.info(`[WarmupStatusViewer] Queuing status view from ${msg.author || msg.from} for instance ${instanceId} in ${Math.round(delayMs / 1000)}s`);
            // 4. Queue the job
            await WarmupQueue_1.WarmupQueue.addStatusJob({
                instanceId,
                messageKey: msg.id,
            }, delayMs);
        }
        catch (err) {
            warmupLogger_1.warmupLogger.error(`[WarmupStatusViewer] Error handling incoming status for instance ${instanceId}:`, err);
        }
    }
    /**
     * Executes the actual read receipt for the status.
     */
    static async viewStatus(client, messageKey) {
        try {
            // whatsapp-web.js doesn't natively expose an easy way to send read receipts for specific status messages via message id without getting the message.
            // But we can try to send seen to the status JID (status@broadcast)
            const chat = await client.getChatById('status@broadcast');
            await chat.sendSeen();
            warmupLogger_1.warmupLogger.info(`[WarmupStatusViewer] Successfully sent read receipt for status ${messageKey.id || messageKey}`);
        }
        catch (err) {
            warmupLogger_1.warmupLogger.error(`[WarmupStatusViewer] Failed to read status ${messageKey.id || messageKey}:`, err);
            throw err;
        }
    }
}
exports.WarmupStatusViewerService = WarmupStatusViewerService;
