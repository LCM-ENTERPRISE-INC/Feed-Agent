import { WASocket, proto } from '@whiskeysockets/baileys';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupProfileService } from './WarmupProfileService';
import { WarmupQueue } from '../queues/WarmupQueue';
import { WarmupStatus } from '@prisma/client';

export class WarmupGroupReaderService {
  /**
   * Evaluates an incoming group message and decides whether to read it.
   * Implements a 40% probability check and queues the read action with a random Jitter (2 mins to 2 hours).
   */
  static async handleIncomingGroupMessage(instanceId: string, msg: proto.IWebMessageInfo, _socket: WASocket): Promise<void> {
    try {
      if (!msg.key || !msg.key.remoteJid?.endsWith('@g.us')) return;

      // 1. Verify if this instance is actively warming up
      const profile = await WarmupProfileService.getProfile(instanceId);
      if (!profile || profile.status !== WarmupStatus.WARMING) {
        return; // Ignore if not in active warmup
      }

      // 2. Probability Check (40% chance to read)
      const shouldRead = Math.random() <= 0.40;
      if (!shouldRead) {
        warmupLogger.info(`[WarmupGroupReader] Ignored group message from ${msg.key.remoteJid} for instance ${instanceId}`);
        return;
      }

      // 3. Jitter: Delay between 2 minutes and 2 hours
      const minDelay = 2 * 60 * 1000;
      const maxDelay = 2 * 60 * 60 * 1000;
      const delayMs = Math.floor(Math.random() * (maxDelay - minDelay)) + minDelay;

      warmupLogger.info(`[WarmupGroupReader] Queuing group read for ${msg.key.remoteJid} for instance ${instanceId} in ${Math.round(delayMs / 60000)}m`);

      // 4. Queue the job
      await WarmupQueue.addGroupReadJob({
        instanceId,
        messageKey: msg.key,
      }, delayMs);

    } catch (err) {
      warmupLogger.error(`[WarmupGroupReader] Error handling incoming group message for instance ${instanceId}:`, err);
    }
  }

  /**
   * Executes the actual read receipt for the group message via Baileys.
   */
  static async readGroupMessage(_socket: WASocket, messageKey: proto.IMessageKey): Promise<void> {
    try {
      await socket.readMessages([messageKey]);
      warmupLogger.info(`[WarmupGroupReader] Successfully sent read receipt for group message ${messageKey.id}`);
    } catch (err) {
      warmupLogger.error(`[WarmupGroupReader] Failed to read group message ${messageKey.id}:`, err);
      throw err;
    }
  }
}
