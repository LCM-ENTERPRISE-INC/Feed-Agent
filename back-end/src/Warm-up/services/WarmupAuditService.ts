import { WarmupHistoryLog } from '../../models/WarmupHistoryLog';
import { warmupLogger } from '../utils/warmupLogger';

export interface InteractionLogData {
  instanceId: string;
  contactJid: string;
  direction: 'SENT' | 'RECEIVED';
  content: string;
  isAiGenerated: boolean;
  metadata?: Record<string, any>;
}

export class WarmupAuditService {
  /**
   * Logs an interaction (message sent/received) into MongoDB asynchronously.
   * Fire-and-forget: it catches its own errors so the main flow is never blocked.
   */
  static logInteraction(data: InteractionLogData): void {
    // We do not await this, it's fire-and-forget
    Promise.resolve().then(async () => {
      try {
        const doc = new WarmupHistoryLog(data);
        await doc.save();
        warmupLogger.debug(`[WarmupAudit] Logged ${data.direction} interaction for instance ${data.instanceId} to DB.`);
      } catch (err: any) {
        warmupLogger.error(`[WarmupAudit] Failed to log interaction to MongoDB for instance ${data.instanceId}:`, err);
      }
    });
  }
}
