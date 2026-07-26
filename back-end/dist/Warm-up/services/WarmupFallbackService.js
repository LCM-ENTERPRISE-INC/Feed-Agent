"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupFallbackService = void 0;
const client_1 = require("@prisma/client");
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupQueue_1 = require("../queues/WarmupQueue");
const prisma = new client_1.PrismaClient();
class WarmupFallbackService {
    /**
     * Acionado quando uma instância sofre um bloqueio temporário (ex: 429).
     * Ele tenta encontrar outra instância saudável (com a menor cota diária gasta) e transfere todos os jobs pendentes para ela.
     */
    static async triggerFallback(failedInstanceId) {
        try {
            warmupLogger_1.warmupLogger.info(`[WarmupFallbackService] Triggered fallback for failed instance ${failedInstanceId}`);
            // 1. Busca todas as instâncias em WARMING, ignorando a que acabou de falhar
            const healthyProfiles = await prisma.warmupProfile.findMany({
                where: {
                    status: client_1.WarmupStatus.WARMING,
                    instanceId: { not: parseInt(failedInstanceId, 10) }
                },
                orderBy: {
                    messagesSentToday: 'asc' // Pega a que tem menos carga gasta hoje
                }
            });
            if (healthyProfiles.length === 0) {
                warmupLogger_1.warmupLogger.warn(`[WarmupFallbackService] No healthy substitute instances found for fallback. Pending jobs for ${failedInstanceId} will not be reassigned.`);
                return false;
            }
            const substituteProfile = healthyProfiles[0];
            const substituteInstanceId = substituteProfile.instanceId.toString();
            warmupLogger_1.warmupLogger.info(`[WarmupFallbackService] Found substitute instance ${substituteInstanceId} for fallback.`);
            // 2. Transfere os jobs no BullMQ
            const transferredCount = await WarmupQueue_1.WarmupQueue.transferJobs(failedInstanceId, substituteInstanceId);
            warmupLogger_1.warmupLogger.info(`[WarmupFallbackService] Fallback completed. Transferred ${transferredCount} jobs from ${failedInstanceId} to ${substituteInstanceId}.`);
            return true;
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupFallbackService] Error during fallback execution:`, error);
            return false;
        }
    }
}
exports.WarmupFallbackService = WarmupFallbackService;
