import { Client, Message } from 'whatsapp-web.js';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupProfileService } from './WarmupProfileService';
import { WarmupQueue } from '../queues/WarmupQueue';
import { WarmupStatus } from '@prisma/client';

export class WarmupGroupReaderService {
  /**
   * Evaluates an incoming group message and decides whether to read it.
   * Implements a 40% probability check and queues the read action with a random Jitter (2 mins to 2 hours).
   */
  static async handleIncomingGroupMessage(instanceId: string, msg: Message, _client: Client): Promise<void> {
    try {
      if (!msg.id || !msg.from.endsWith('@g.us')) return;

      // 1. Verify if this instance is actively warming up
      const profile = await WarmupProfileService.getProfile(instanceId);
      if (!profile || profile.status !== WarmupStatus.WARMING) {
        return; // Ignore if not in active warmup
      }

      // 2. Probability Check (40% chance to read)
      const shouldRead = Math.random() <= 0.40;
      if (!shouldRead) {
        warmupLogger.info(`[WarmupGroupReader] Ignored group message from ${msg.from} for instance ${instanceId}`);
        return;
      }

      // 3. Jitter: Delay between 2 minutes and 2 hours
      const minDelay = 2 * 60 * 1000;
      const maxDelay = 2 * 60 * 60 * 1000;
      const delayMs = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

      warmupLogger.info(`[WarmupGroupReader] Queuing group read for ${msg.from} for instance ${instanceId} in ${Math.round(delayMs / 60000)}m`);

      // 4. Queue the job
      await WarmupQueue.addGroupReadJob({
        instanceId,
        messageKey: msg.id,
      }, delayMs);

    } catch (err) {
      warmupLogger.error(`[WarmupGroupReader] Error handling incoming group message for instance ${instanceId}:`, err);
    }
  }

  /**
   * Executes the actual read receipt for the group message.
   */
  static async readGroupMessage(client: Client, messageKey: any): Promise<void> {
    try {
      const chat = await client.getChatById(messageKey.remote);
      await chat.sendSeen();
      warmupLogger.info(`[WarmupGroupReader] Successfully sent read receipt for group message ${messageKey.id}`);
    } catch (err) {
      warmupLogger.error(`[WarmupGroupReader] Failed to read group message ${messageKey.id}:`, err);
      throw err;
    }
  }
}
