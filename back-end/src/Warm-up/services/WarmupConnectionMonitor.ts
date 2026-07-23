import { WarmupProfileService } from './WarmupProfileService';
import { WarmupStatus } from '@prisma/client';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupAlertService } from './WarmupAlertService';
import type { WhatsAppService } from '../../services/WhatsAppService'; // Assuming it's an EventEmitter
import { Boom } from '@hapi/boom';

export class WarmupConnectionMonitor {
  /**
   * Attaches listeners to a WhatsAppService instance to monitor its connection state
   * and automatically pause/resume the Warmup process to avoid bans during network drops.
   */
  static attachMonitor(service: WhatsAppService, instanceId: number) {
    const instanceIdStr = String(instanceId);

    // Using any to bypass strict type checking if WhatsAppService doesn't explicitly type these events
    const emitter = service as any;

    // Triggered when the socket is closed/disconnected
    emitter.on('close', async (reason?: string) => {
      warmupLogger.warn(`[WarmupConnectionMonitor] Connection closed for instance ${instanceId}. Reason: ${reason}`);
      
      const reasonStr = reason || '';
      if (reasonStr.includes('401') || reasonStr.includes('403') || reasonStr.includes('405')) {
        await WarmupAlertService.sendCriticalAlert(
          instanceIdStr,
          `Critical Disconnect Reason: ${reasonStr}`,
          'CRITICAL'
        );
      }

      try {
        // We pause the warmup to prevent BullMQ from accumulating messages and blasting them on reconnect
        await WarmupProfileService.updateStatus(
          instanceIdStr,
          WarmupStatus.PAUSED,
          `Connection Dropped. Reason: ${reason || 'Unknown'}`
        );
      } catch (err: any) {
        if (err instanceof Boom && err.output.statusCode === 404) {
          // Warmup profile doesn't exist for this instance, safely ignore
          return;
        }
        warmupLogger.error(`[WarmupConnectionMonitor] Failed to auto-pause warmup for instance ${instanceId}`, err);
      }
    });

    // Triggered when the socket successfully reconnects
    emitter.on('open', async () => {
      warmupLogger.info(`[WarmupConnectionMonitor] Connection opened for instance ${instanceId}. Checking if auto-resume is needed.`);
      try {
        const profile = await WarmupProfileService.getProfile(instanceIdStr);
        
        // We only auto-resume if it was paused. If it's IDLE, WARMING, COMPLETED or BANNED, we leave it alone.
        // Furthermore, we could check the last history log to see if it was paused specifically by the Monitor.
        if (profile.status === WarmupStatus.PAUSED) {
          const lastLog = profile.statusHistory[0];
          if (lastLog && lastLog.reason?.includes('Connection Dropped')) {
            await WarmupProfileService.updateStatus(
              instanceIdStr,
              WarmupStatus.IDLE, // Switch to IDLE, the rule engine will pick it up and change to WARMING
              'Auto-resumed after connection restored'
            );
          }
        }
      } catch (err: any) {
        if (err instanceof Boom && err.output.statusCode === 404) {
          // Warmup profile doesn't exist
          return;
        }
        warmupLogger.error(`[WarmupConnectionMonitor] Failed to auto-resume warmup for instance ${instanceId}`, err);
      }
    });

    warmupLogger.info(`[WarmupConnectionMonitor] Attached listeners to instance ${instanceId}`);
  }
}
