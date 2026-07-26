"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupBroadcastIntegrationService = void 0;
const prismaClient_1 = __importDefault(require("../../models/prismaClient"));
const WhatsAppInstanceManager_1 = __importDefault(require("../../services/WhatsAppInstanceManager"));
const client_1 = require("@prisma/client");
const warmupLogger_1 = require("../utils/warmupLogger");
class WarmupBroadcastIntegrationService {
    /**
     * Retorna apenas as instâncias conectadas de um usuário que estão elegíveis para
     * realizar disparos de broadcast (não estão em processo de aquecimento pendente).
     */
    static async getEligibleInstancesForBroadcast(userId) {
        try {
            // 1. Busca todas as instâncias ativas da memória
            const allUserInstances = WhatsAppInstanceManager_1.default.getInstancesForUser(userId).filter(inst => inst.getStatus().state === 'open');
            if (allUserInstances.length === 0) {
                return [];
            }
            // 2. Busca o estado de Warmup dessas instâncias no banco
            const instanceIds = allUserInstances.map(inst => inst.getInstanceId());
            const dbInstances = await prismaClient_1.default.whatsAppInstance.findMany({
                where: { id: { in: instanceIds } },
                include: { warmupProfile: true }
            });
            // 3. Filtra: só permite instâncias SEM perfil de warmup (virgens) 
            // ou com perfil COMPLETED
            const eligibleIds = new Set();
            for (const dbInst of dbInstances) {
                if (!dbInst.warmupProfile) {
                    eligibleIds.add(dbInst.id);
                }
                else if (dbInst.warmupProfile.status === client_1.WarmupStatus.COMPLETED) {
                    eligibleIds.add(dbInst.id);
                }
                else {
                    warmupLogger_1.warmupLogger.info(`[WarmupBroadcastIntegration] Instance ${dbInst.id} is blocked from broadcast because it is in status ${dbInst.warmupProfile.status}`);
                }
            }
            return allUserInstances.filter(inst => eligibleIds.has(inst.getInstanceId()));
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupBroadcastIntegration] Failed to get eligible instances for user ${userId}:`, error);
            return [];
        }
    }
}
exports.WarmupBroadcastIntegrationService = WarmupBroadcastIntegrationService;
