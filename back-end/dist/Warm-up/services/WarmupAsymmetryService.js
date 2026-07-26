"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupAsymmetryService = void 0;
const WarmupCacheService_1 = require("./WarmupCacheService");
const warmupLogger_1 = require("../utils/warmupLogger");
class WarmupAsymmetryService {
    // Limite de assimetria acordado (10 envios sem receber nenhuma resposta)
    static ASYMMETRY_RATIO_LIMIT = 10;
    /**
     * Avalia a proporção atual e, se estiver assimétrica, pausa os envios da instância.
     */
    static async evaluateAndBlockIfNeeded(instanceId) {
        const state = await WarmupCacheService_1.WarmupCacheService.getState(instanceId);
        if (!state)
            return true; // Se não tem estado ainda, pode enviar.
        // Se já estiver pausado (por assimetria ou outro motivo), bloqueia
        if (state.isPaused) {
            warmupLogger_1.warmupLogger.warn(`[WarmupAsymmetryService] Instance ${instanceId} is currently PAUSED. Blocking send.`);
            return false;
        }
        const sent = state.messagesSentInCurrentBatch;
        const received = state.messagesReceivedInCurrentBatch;
        // Proteção contra divisão por zero. Se recebeu 0, consideramos 1 para o ratio
        const receivedDenominator = Math.max(received, 1);
        const ratio = sent / receivedDenominator;
        if (ratio >= this.ASYMMETRY_RATIO_LIMIT && sent >= this.ASYMMETRY_RATIO_LIMIT) {
            warmupLogger_1.warmupLogger.error(`[WarmupAsymmetryService] CRITICAL ASYMMETRY DETECTED for instance ${instanceId}. Sent: ${sent}, Received: ${received}. Pausing instance.`);
            state.isPaused = true;
            await WarmupCacheService_1.WarmupCacheService.setState(instanceId, state);
            return false;
        }
        return true;
    }
    /**
     * Registra o recebimento de uma mensagem, melhorando a métrica de assimetria.
     */
    static async registerReceivedMessage(instanceId) {
        await WarmupCacheService_1.WarmupCacheService.incrementMessagesReceived(instanceId);
        warmupLogger_1.warmupLogger.info(`[WarmupAsymmetryService] Received message registered for instance ${instanceId}. Asymmetry improved.`);
    }
}
exports.WarmupAsymmetryService = WarmupAsymmetryService;
