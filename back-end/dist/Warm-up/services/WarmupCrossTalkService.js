"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupCrossTalkService = void 0;
const client_1 = require("@prisma/client");
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupQueue_1 = require("../queues/WarmupQueue");
const WhatsAppInstanceManager_1 = __importDefault(require("../../services/WhatsAppInstanceManager"));
const prisma = new client_1.PrismaClient();
class WarmupCrossTalkService {
    /**
     * Identifica instâncias ativas do mesmo cliente (userId) e agenda conversas cruzadas.
     */
    static async scheduleCrossTalks() {
        try {
            warmupLogger_1.warmupLogger.info(`[WarmupCrossTalkService] Scheduling cross-talks...`);
            // Buscar todos os perfis ativos e concluídos com o userId incluído
            const profiles = await prisma.warmupProfile.findMany({
                where: {
                    status: { in: [client_1.WarmupStatus.WARMING, client_1.WarmupStatus.COMPLETED] }
                },
                include: {
                    instance: true
                }
            });
            if (profiles.length < 2) {
                warmupLogger_1.warmupLogger.info(`[WarmupCrossTalkService] Not enough active profiles for cross-talk.`);
                return;
            }
            // Agrupar por userId
            const userGroups = new Map();
            for (const p of profiles) {
                const uId = p.instance.userId;
                if (!userGroups.has(uId)) {
                    userGroups.set(uId, []);
                }
                userGroups.get(uId).push(p);
            }
            const baseStartMs = 10 * 60 * 1000;
            const windowMs = 40 * 60 * 1000;
            for (const [userId, userProfiles] of userGroups.entries()) {
                if (userProfiles.length < 2)
                    continue;
                warmupLogger_1.warmupLogger.info(`[WarmupCrossTalkService] Found ${userProfiles.length} instances for user ${userId}. Creating pairs...`);
                // Embaralha para que os pares sejam aleatórios
                const shuffled = [...userProfiles].sort(() => Math.random() - 0.5);
                for (let i = 0; i < shuffled.length; i++) {
                    const initiator = shuffled[i];
                    // Pega o próximo como alvo, e o último ataca o primeiro (Round-Robin)
                    const target = shuffled[(i + 1) % shuffled.length];
                    const targetService = WhatsAppInstanceManager_1.default.getInstance(target.instanceId);
                    if (!targetService)
                        continue;
                    const targetClient = targetService.getClient();
                    const targetJidRaw = targetClient?.info?.wid?.user;
                    if (!targetJidRaw) {
                        warmupLogger_1.warmupLogger.warn(`[WarmupCrossTalkService] Could not retrieve JID for target instance ${target.instanceId}`);
                        continue;
                    }
                    const targetPhone = targetJidRaw;
                    const intervalMs = Math.floor(windowMs / userProfiles.length);
                    const slotStartMs = baseStartMs + (i * intervalMs);
                    const jitterOffsetMs = Math.floor(intervalMs * 0.1) + Math.floor(Math.random() * (intervalMs * 0.8));
                    const delayMs = slotStartMs + jitterOffsetMs;
                    warmupLogger_1.warmupLogger.info(`[WarmupCrossTalkService] Enqueueing cross-talk: ${initiator.instanceId} -> ${targetPhone} with delay ${delayMs}ms`);
                    await WarmupQueue_1.WarmupQueue.addSeedMessageJob({
                        instanceId: initiator.instanceId.toString(),
                        seedPhone: targetPhone
                    }, delayMs);
                }
            }
            warmupLogger_1.warmupLogger.info(`[WarmupCrossTalkService] Successfully scheduled cross-talks.`);
        }
        catch (err) {
            warmupLogger_1.warmupLogger.error(`[WarmupCrossTalkService] Failed to schedule cross-talks:`, err);
        }
    }
}
exports.WarmupCrossTalkService = WarmupCrossTalkService;
