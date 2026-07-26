import { Client, Message } from 'whatsapp-web.js';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupQueue } from '../queues/WarmupQueue';
import LlamaService from '../../services/LlamaService';
import { WarmupPersonaService } from './WarmupPersonaService';
import { WarmupCacheService } from './WarmupCacheService';
import { WarmupAIFilterService } from './WarmupAIFilterService';
import { WarmupTypoService } from './WarmupTypoService';
import { WarmupAuditService } from './WarmupAuditService';
import { WarmupProfileService } from './WarmupProfileService';
import { WarmupJitterService } from './WarmupJitterService';
import { WarmupBackoffService } from './WarmupBackoffService';
import { WarmupPhase } from '@prisma/client';

export class WarmupEventTriggerService {
  /**
   * Avalia a mensagem recebida e decide se deve acionar um gatilho de resposta (ex: emoji '👍').
   */
  static async evaluateIncomingMessage(instanceId: string, msg: Message, _client: Client): Promise<void> {
    try {
      if (!msg.id || !msg.from) return;

      const remoteJid = msg.from;
      const fromMe = msg.fromMe;
      
      if (fromMe) return; // Não responde a si mesmo
      if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) return;

      const text = msg.body;
      if (!text || text.length < 2) return;

      // Drop rate de 20% para evitar loops infinitos entre bots
      if (Math.random() < 0.20) {
        warmupLogger.info(`[WarmupEventTrigger] Natural drop (20% chance). Ignoring message from ${remoteJid} on instance ${instanceId}.`);
        return;
      }

      warmupLogger.info(`[WarmupEventTrigger] Received text from ${remoteJid} on instance ${instanceId}. Evaluating with AI...`);

      // Extract phone number from JID (e.g. 5511999999999@c.us)
      const contactPhone = remoteJid.split('@')[0];

      // Auditoria: Gravamos a recepção da mensagem organicamente no MongoDB
      WarmupAuditService.logInteraction({
        instanceId,
        contactJid: remoteJid,
        direction: 'RECEIVED',
        content: text,
        isAiGenerated: false
      });
      
      // Salva a mensagem recebida no histórico e puxa o contexto
      await WarmupCacheService.appendConversationHistory(instanceId, contactPhone, text, 'other');
      const history = await WarmupCacheService.getConversationHistory(instanceId, contactPhone);

      let replyContent = '👍';
      try {
        const prompt = WarmupPersonaService.getReplyPrompt(text, history);
        const systemPrompt = WarmupPersonaService.getSystemPrompt();
        replyContent = await LlamaService.generateCompletion(prompt, systemPrompt, { max_tokens: 40 });
        replyContent = WarmupAIFilterService.validate(replyContent, 'reply');
      } catch (aiError) {
        warmupLogger.warn(`[WarmupEventTrigger] AI evaluation failed, using static fallback (thumbs up) for instance ${instanceId}. Error: ${aiError}`);
        // Fallback to emoji if text contains some positive keyword
        const positiveKeywords = /\b(sim|ok|beleza|tranquilo|tá|tudo|ótimo|bom|joia|show)\b/i;
        if (!positiveKeywords.test(text.trim())) {
          return; // If AI failed and it's not a simple positive keyword, don't reply to avoid weirdness
        }
      }

      if (!replyContent) replyContent = '👍';

      // Buscar Fase e Limite Diário
      const profile = await WarmupProfileService.getProfile(instanceId);
      const state = await WarmupCacheService.getState(instanceId);
      const failureCount = state?.consecutiveFailures || 0;
      
      // Artificial Jitter dinâmico baseado na Fase e Escala
      const delayMs = WarmupJitterService.getDelayForPhase(
        profile.currentPhase as WarmupPhase,
        failureCount,
        profile.dailyLimit
      );

      // Apply typo simulation
      const { text: typoReply, correction } = WarmupTypoService.generateTypo(replyContent);
      const shouldDelete = WarmupTypoService.shouldDelete();

      // Enfileira o job de resposta a evento
      await WarmupQueue.addEventReplyJob({
        instanceId,
        targetJid: remoteJid,
        content: typoReply,
        correction,
        shouldDelete
      }, delayMs);
      
      // Salva a resposta gerada no histórico (como 'me')
      await WarmupCacheService.appendConversationHistory(instanceId, contactPhone, typoReply, 'me');
      if (correction) {
        await WarmupCacheService.appendConversationHistory(instanceId, contactPhone, correction, 'me');
      }
      
      warmupLogger.info(`[WarmupEventTrigger] Queued AI reply for ${remoteJid}: "${typoReply}" with jitter ${delayMs}ms`);
    } catch (error) {
      warmupLogger.error(`[WarmupEventTrigger] Error evaluating incoming message for instance ${instanceId}:`, error);
    }
  }
}
