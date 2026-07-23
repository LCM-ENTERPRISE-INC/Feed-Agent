import { WASocket } from '@whiskeysockets/baileys';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupProfileService } from './WarmupProfileService';
import { WarmupSeedContactService } from './WarmupSeedContactService';
import { WarmupCacheService } from './WarmupCacheService';
import { WarmupQueue } from '../queues/WarmupQueue';
import { WarmupBaileysService } from './WarmupBaileysService';
import { toWhatsAppJid } from '../../utils/phoneUtils';
import LlamaService from '../../services/LlamaService';
import { WarmupPersonaService } from './WarmupPersonaService';
import { WarmupAIFilterService } from './WarmupAIFilterService';
import { WarmupTypoService } from './WarmupTypoService';
import { WarmupAuditService } from './WarmupAuditService';
import { delay } from '@whiskeysockets/baileys';

export class WarmupSeedMessagingService {
  private static QUESTIONS = [
    'Tudo bem por aí?',
    'Bom dia, tranquilo?',
    'Pode falar agora?',
    'Opa, tá ocupado?',
    'Como estão as coisas?',
    'Oi! Tudo certo?'
  ];

  /**
   * Called by the Cron every hour during business hours.
   * Fetches active profiles, picks a random seed contact, and schedules a message.
   */
  static async scheduleSeedMessages(): Promise<void> {
    try {
      warmupLogger.info(`[WarmupSeedMessaging] Evaluating seed messages for all active instances...`);
      const profiles = await WarmupProfileService.getActiveProfiles();

      if (profiles.length === 0) {
        warmupLogger.info(`[WarmupSeedMessaging] No active profiles found, skipping...`);
        return;
      }

      // Distribuição Espacial Temporal (Round-Robin)
      // Usaremos os 50 minutos centrais da hora (minuto 5 até o minuto 55)
      const baseStartMs = 5 * 60 * 1000;
      const windowMs = 50 * 60 * 1000;
      
      // O intervalo para cada instância
      let intervalMs = Math.floor(windowMs / profiles.length);
      
      // Limite inferior seguro para não atolar a fila (mínimo de 3 segundos por instância)
      if (intervalMs < 3000) {
        intervalMs = 3000;
        warmupLogger.warn(`[WarmupSeedMessaging] Heavy load detected! Interval clamped to 3s for ${profiles.length} profiles.`);
      }

      // Shuffle profiles para garantir que a ordem mude a cada hora
      const shuffledProfiles = [...profiles].sort(() => Math.random() - 0.5);

      for (let i = 0; i < shuffledProfiles.length; i++) {
        const profile = shuffledProfiles[i];
        const seedContacts = await WarmupSeedContactService.listSeedContacts(profile.instanceId.toString());
        
        if (seedContacts.length === 0) {
          warmupLogger.info(`[WarmupSeedMessaging] No seed contacts for instance ${profile.instanceId}, skipping...`);
          continue;
        }

        // Pick one random seed contact
        const randomContact = seedContacts[Math.floor(Math.random() * seedContacts.length)];

        // O bloco de tempo "reservado" para esta instância
        const slotStartMs = baseStartMs + (i * intervalMs);
        
        // Micro-Jitter (aleatoriedade dentro do bloco, entre 10% e 90% do bloco)
        const jitterOffsetMs = Math.floor(intervalMs * 0.1) + Math.floor(Math.random() * (intervalMs * 0.8));
        
        const delayMs = slotStartMs + jitterOffsetMs;

        await WarmupQueue.addSeedMessageJob({
          instanceId: profile.instanceId.toString(),
          seedPhone: randomContact.phoneNumber
        }, delayMs);
      }
      
      warmupLogger.info(`[WarmupSeedMessaging] Successfully distributed seed messages for ${profiles.length} profiles.`);
    } catch (err) {
      warmupLogger.error(`[WarmupSeedMessaging] Failed to schedule seed messages:`, err);
    }
  }

  /**
   * Executes the actual message sending via Baileys.
   */
  static async executeSeedMessage(socket: WASocket, instanceId: string, seedPhone: string): Promise<void> {
    try {
      warmupLogger.info(`[WarmupSeedMessaging] Executing seed message for instance ${instanceId} to ${seedPhone}...`);
      let messageToSend = '';
      try {
        const prompt = WarmupPersonaService.getSeedMessagePrompt();
        const systemPrompt = WarmupPersonaService.getSystemPrompt();
        messageToSend = await LlamaService.generateCompletion(prompt, systemPrompt, { max_tokens: 30 });
        messageToSend = WarmupAIFilterService.validate(messageToSend, 'seed');
      } catch (aiError) {
        warmupLogger.warn(`[WarmupSeedMessaging] AI generation failed, using static fallback for instance ${instanceId}. Error: ${aiError}`);
        messageToSend = this.QUESTIONS[Math.floor(Math.random() * this.QUESTIONS.length)];
      }

      if (!messageToSend) {
        messageToSend = this.QUESTIONS[Math.floor(Math.random() * this.QUESTIONS.length)];
      }

      // Apply typo simulation
      const { text, correction } = WarmupTypoService.generateTypo(messageToSend);
      const shouldDelete = WarmupTypoService.shouldDelete();

      const jid = toWhatsAppJid(seedPhone);
      const sentKey = await WarmupBaileysService.sendWarmupMessage(socket, jid, text);
      
      if (shouldDelete && sentKey) {
        warmupLogger.info(`[WarmupSeedMessaging] Simulating regret! Deleting message for ${seedPhone}...`);
        await delay(Math.floor(Math.random() * 3000) + 2000); // Wait 2-5s
        await WarmupBaileysService.deleteWarmupMessage(socket, jid, sentKey);
        
        WarmupAuditService.logInteraction({
          instanceId,
          contactJid: jid,
          direction: 'SENT',
          content: text,
          isAiGenerated: true,
          metadata: { deleted: true }
        });
        
        // Aborta o resto, não manda mais nada.
        return;
      }

      await WarmupCacheService.appendConversationHistory(instanceId, seedPhone, text, 'me');
      
      WarmupAuditService.logInteraction({
        instanceId,
        contactJid: jid,
        direction: 'SENT',
        content: text,
        isAiGenerated: true,
        metadata: { typoSimulated: !!correction }
      });
      
      warmupLogger.info(`[WarmupSeedMessaging] Seed message successfully sent for instance ${instanceId} to ${seedPhone}. Text: "${text}"`);

      // Se houver correção ortográfica a fazer
      if (correction) {
        warmupLogger.info(`[WarmupSeedMessaging] Sending typo correction: "${correction}" for instance ${instanceId}`);
        await delay(Math.floor(Math.random() * 2000) + 1000); // 1-3s delay to realize the mistake
        await WarmupBaileysService.sendWarmupMessage(socket, jid, correction);
        await WarmupCacheService.appendConversationHistory(instanceId, seedPhone, correction, 'me');
        
        WarmupAuditService.logInteraction({
          instanceId,
          contactJid: jid,
          direction: 'SENT',
          content: correction,
          isAiGenerated: false,
          metadata: { isCorrection: true }
        });
      }
    } catch (err) {
      warmupLogger.error(`[WarmupSeedMessaging] Failed to send seed message for instance ${instanceId}:`, err);
      throw err;
    }
  }
}
