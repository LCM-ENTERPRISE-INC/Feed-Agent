"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupMetricsService = void 0;
const WarmupProfileService_1 = require("./WarmupProfileService");
const WarmupCacheService_1 = require("./WarmupCacheService");
const WarmupTrustScoreService_1 = require("./WarmupTrustScoreService");
const WhatsAppInstanceManager_1 = __importDefault(require("../../services/WhatsAppInstanceManager"));
const boom_1 = require("@hapi/boom");
class WarmupMetricsService {
    /**
     * Consolidates data from PostgreSQL, Redis, and the Baileys socket
     * to provide a unified dashboard state for a specific instance.
     */
    static async getInstanceMetrics(instanceIdStr) {
        const instanceId = parseInt(instanceIdStr, 10);
        // 1. PostgreSQL (Persistent data)
        let profile;
        try {
            profile = await WarmupProfileService_1.WarmupProfileService.getProfile(instanceIdStr);
        }
        catch (err) {
            if (err instanceof boom_1.Boom && err.output.statusCode === 404) {
                throw new boom_1.Boom(`Cannot fetch metrics. Warmup profile for instance ${instanceId} does not exist.`, { statusCode: 404 });
            }
            throw err;
        }
        // 2. Redis (Volatile data)
        const ephemeralState = await WarmupCacheService_1.WarmupCacheService.getState(instanceIdStr);
        // 3. Client (Connection data)
        const whatsappInstance = WhatsAppInstanceManager_1.default.getInstance(instanceId);
        const isConnected = whatsappInstance && whatsappInstance.getClient() ? true : false;
        // Calculate naive uptime hours based on when the profile was created
        const createdMs = new Date(profile.createdAt).getTime();
        const nowMs = Date.now();
        const uptimeHours = parseFloat(((nowMs - createdMs) / (1000 * 60 * 60)).toFixed(2));
        const sent = ephemeralState?.messagesSentInCurrentBatch || 0;
        const received = ephemeralState?.messagesReceivedInCurrentBatch || 0;
        const trustData = await WarmupTrustScoreService_1.WarmupTrustScoreService.calculateScore(profile.id, profile.currentPhase, sent, received);
        return {
            instanceId,
            isSocketConnected: isConnected,
            status: profile.status,
            currentPhase: profile.currentPhase,
            dailyLimit: profile.dailyLimit,
            messagesSentInCurrentBatch: sent,
            isVolatilePaused: ephemeralState?.isPaused || false,
            lastActionTimestamp: ephemeralState?.lastActionTimestamp || null,
            uptimeHours,
            trustScore: trustData.score,
            riskLevel: trustData.riskLevel
        };
    }
}
exports.WarmupMetricsService = WarmupMetricsService;
