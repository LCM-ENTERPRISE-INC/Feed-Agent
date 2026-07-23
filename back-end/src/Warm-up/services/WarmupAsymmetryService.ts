import { WarmupCacheService } from './WarmupCacheService';
import { warmupLogger } from '../utils/warmupLogger';

export class WarmupAsymmetryService {
  // Limite de assimetria acordado (10 envios sem receber nenhuma resposta)
  private static readonly ASYMMETRY_RATIO_LIMIT = 10;

  /**
   * Avalia a proporção atual e, se estiver assimétrica, pausa os envios da instância.
   */
  static async evaluateAndBlockIfNeeded(instanceId: string): Promise<boolean> {
    const state = await WarmupCacheService.getState(instanceId);
    
    if (!state) return true; // Se não tem estado ainda, pode enviar.

    // Se já estiver pausado (por assimetria ou outro motivo), bloqueia
    if (state.isPaused) {
      warmupLogger.warn(`[WarmupAsymmetryService] Instance ${instanceId} is currently PAUSED. Blocking send.`);
      return false;
    }

    const sent = state.messagesSentInCurrentBatch;
    const received = state.messagesReceivedInCurrentBatch;

    // Proteção contra divisão por zero. Se recebeu 0, consideramos 1 para o ratio
    const receivedDenominator = Math.max(received, 1);
    
    const ratio = sent / receivedDenominator;

    if (ratio >= this.ASYMMETRY_RATIO_LIMIT && sent >= this.ASYMMETRY_RATIO_LIMIT) {
      warmupLogger.error(`[WarmupAsymmetryService] CRITICAL ASYMMETRY DETECTED for instance ${instanceId}. Sent: ${sent}, Received: ${received}. Pausing instance.`);
      
      state.isPaused = true;
      await WarmupCacheService.setState(instanceId, state);
      return false;
    }

    return true;
  }

  /**
   * Registra o recebimento de uma mensagem, melhorando a métrica de assimetria.
   */
  static async registerReceivedMessage(instanceId: string): Promise<void> {
    await WarmupCacheService.incrementMessagesReceived(instanceId);
    warmupLogger.info(`[WarmupAsymmetryService] Received message registered for instance ${instanceId}. Asymmetry improved.`);
  }
}
