import { proto, WASocket } from '@whiskeysockets/baileys';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupProfileService } from './WarmupProfileService';
import { WarmupQueue } from '../queues/WarmupQueue';
import { WarmupStatus } from '@prisma/client';

export class WarmupStatusViewerService {
  /**
   * Evaluates an incoming status broadcast and decides whether to "view" it (send read receipt).
   * Implements a 70% probability check and queues the view action with a random Jitter.
   */
  static async handleIncomingStatus(instanceId: string, msg: proto.IWebMessageInfo, _socket: WASocket): Promise<void> {
    try {
      if (!msg.key) return;

      // 1. Verify if this instance is actively warming up
      const profile = await WarmupProfileService.getProfile(instanceId);
      if (!profile || profile.status !== WarmupStatus.WARMING) {
        return; // Ignore if not in active warmup
      }

      // 2. Probability Check (70% chance to view)
      const shouldView = Math.random() <= 0.7;
      if (!shouldView) {
        warmupLogger.info(`[WarmupStatusViewer] Ignored status from ${msg.key.participant || msg.key.remoteJid} for instance ${instanceId} (simulating human ignoring)`);
        return;
      }

      // 3. Jitter: Delay between 30 seconds and 15 minutes
      const delayMs = Math.floor(Math.random() * (15 * 60 * 1000 - 30 * 1000)) + 30 * 1000;

      warmupLogger.info(`[WarmupStatusViewer] Queuing status view from ${msg.key.participant || msg.key.remoteJid} for instance ${instanceId} in ${Math.round(delayMs / 1000)}s`);

      // 4. Queue the job
      await WarmupQueue.addStatusJob({
        instanceId,
        messageKey: msg.key,
      }, delayMs);

    } catch (err) {
      warmupLogger.error(`[WarmupStatusViewer] Error handling incoming status for instance ${instanceId}:`, err);
    }
  }

  /**
   * Executes the actual read receipt for the status via Baileys.
   */
  static async viewStatus(_socket: WASocket, messageKey: proto.IMessageKey): Promise<void> {
    try {
      await socket.readMessages([messageKey]);
      warmupLogger.info(`[WarmupStatusViewer] Successfully sent read receipt for status ${messageKey.id}`);
    } catch (err) {
      warmupLogger.error(`[WarmupStatusViewer] Failed to read status ${messageKey.id}:`, err);
      throw err;
    }
  }
}
