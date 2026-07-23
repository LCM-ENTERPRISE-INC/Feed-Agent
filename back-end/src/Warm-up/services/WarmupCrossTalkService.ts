import { PrismaClient, WarmupStatus } from '@prisma/client';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupQueue } from '../queues/WarmupQueue';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import { toWhatsAppJid } from '../../utils/phoneUtils';

const prisma = new PrismaClient();

export class WarmupCrossTalkService {
  /**
   * Identifica instâncias ativas do mesmo cliente (userId) e agenda conversas cruzadas.
   */
  static async scheduleCrossTalks(): Promise<void> {
    try {
      warmupLogger.info(`[WarmupCrossTalkService] Scheduling cross-talks...`);
      
      // Buscar todos os perfis ativos e concluídos com o userId incluído
      const profiles = await prisma.warmupProfile.findMany({
        where: { 
          status: { in: [WarmupStatus.WARMING, WarmupStatus.COMPLETED] }
        },
        include: {
          instance: true
        }
      });

      if (profiles.length < 2) {
        warmupLogger.info(`[WarmupCrossTalkService] Not enough active profiles for cross-talk.`);
        return;
      }

      // Agrupar por userId
      const userGroups = new Map<number, typeof profiles>();

      for (const p of profiles) {
        const uId = p.instance.userId;
        if (!userGroups.has(uId)) {
          userGroups.set(uId, []);
        }
        userGroups.get(uId)!.push(p);
      }

      const baseStartMs = 10 * 60 * 1000;
      const windowMs = 40 * 60 * 1000;

      for (const [userId, userProfiles] of userGroups.entries()) {
        if (userProfiles.length < 2) continue;

        warmupLogger.info(`[WarmupCrossTalkService] Found ${userProfiles.length} instances for user ${userId}. Creating pairs...`);

        // Embaralha para que os pares sejam aleatórios
        const shuffled = [...userProfiles].sort(() => Math.random() - 0.5);

        for (let i = 0; i < shuffled.length; i++) {
          const initiator = shuffled[i];
          // Pega o próximo como alvo, e o último ataca o primeiro (Round-Robin)
          const target = shuffled[(i + 1) % shuffled.length];

          const targetService = whatsAppInstanceManager.getInstance(target.instanceId);
          if (!targetService) continue;

          const targetSocket = targetService.getSocket();
          const targetJidRaw = targetSocket?.user?.id;
          
          if (!targetJidRaw) {
             warmupLogger.warn(`[WarmupCrossTalkService] Could not retrieve JID for target instance ${target.instanceId}`);
             continue;
          }

          const targetPhone = targetJidRaw.split(':')[0].split('@')[0];

          const intervalMs = Math.floor(windowMs / userProfiles.length);
          const slotStartMs = baseStartMs + (i * intervalMs);
          const jitterOffsetMs = Math.floor(intervalMs * 0.1) + Math.floor(Math.random() * (intervalMs * 0.8));
          const delayMs = slotStartMs + jitterOffsetMs;

          warmupLogger.info(`[WarmupCrossTalkService] Enqueueing cross-talk: ${initiator.instanceId} -> ${targetPhone} with delay ${delayMs}ms`);

          await WarmupQueue.addSeedMessageJob({
            instanceId: initiator.instanceId.toString(),
            seedPhone: targetPhone
          }, delayMs);
        }
      }

      warmupLogger.info(`[WarmupCrossTalkService] Successfully scheduled cross-talks.`);
    } catch (err) {
      warmupLogger.error(`[WarmupCrossTalkService] Failed to schedule cross-talks:`, err);
    }
  }
}
