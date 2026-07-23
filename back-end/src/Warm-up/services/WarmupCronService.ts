import { WarmupBusinessHoursService } from './WarmupBusinessHoursService';
import { WarmupQueue } from '../queues/WarmupQueue';
import { WarmupStatusPublisherService } from './WarmupStatusPublisherService';
import { WarmupSeedMessagingService } from './WarmupSeedMessagingService';
import { WarmupPhaseManagerService } from './WarmupPhaseManagerService';
import { WarmupCleanupService } from './WarmupCleanupService';
import { warmupLogger } from '../utils/warmupLogger';

export class WarmupCronService {
  private static timer: NodeJS.Timeout | null = null;
  private static isCurrentlyPaused: boolean = false;
  private static lastSeedTick: number = 0;
  private static lastPhaseTick: number = 0;

  /**
   * Starts the internal polling cron that checks business hours every minute.
   * If it detects off-hours, it halts the entire warmup queue.
   */
  static startBusinessHoursCron() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    warmupLogger.info(`[WarmupCronService] Starting business hours monitoring cron...`);
    
    // Evaluate immediately
    this.evaluateSleepCycle();

    // Re-evaluate every 1 minute
    this.timer = setInterval(() => {
      this.evaluateSleepCycle();
    }, 60000);
  }

  static stopBusinessHoursCron() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      warmupLogger.info(`[WarmupCronService] Business hours monitoring cron stopped.`);
    }
  }

  private static async evaluateSleepCycle() {
    try {
      const now = Date.now();

      // Avaliação Diária de Fases e Limites (Roda uma vez a cada 24h)
      if (now - this.lastPhaseTick > 24 * 60 * 60 * 1000) {
        // Alinhando para rodar preferencialmente na primeira checagem do dia
        this.lastPhaseTick = now;
        warmupLogger.info(`[WarmupCronService] Triggering daily phase evaluation and cleanup...`);
        await WarmupPhaseManagerService.evaluateAllProfiles();
        
        // Dispara limpeza de cache em background (sem await para não travar o cron)
        WarmupCleanupService.runDailyCleanup().catch(err => {
          warmupLogger.error(`[WarmupCronService] Failed to run daily cleanup:`, err);
        });
      }

      const isBusinessHours = WarmupBusinessHoursService.isBusinessHours();

      if (!isBusinessHours && !this.isCurrentlyPaused) {
        warmupLogger.info(`[WarmupCronService] Off-hours detected. Putting Warmup to sleep...`);
        await WarmupQueue.pauseQueue();
        this.isCurrentlyPaused = true;
      } else if (isBusinessHours && this.isCurrentlyPaused) {
        warmupLogger.info(`[WarmupCronService] Business hours started. Waking up Warmup...`);
        await WarmupQueue.resumeQueue();
        this.isCurrentlyPaused = false;
        
        // Schedule morning statuses for everyone who woke up
        await WarmupStatusPublisherService.scheduleMorningStatuses();
      }

      // Every 1 hour during business hours, evaluate seed messages
      if (isBusinessHours) {
        const now = Date.now();
        if (now - this.lastSeedTick > 60 * 60 * 1000) {
          warmupLogger.info(`[WarmupCronService] Hourly seed message tick triggered.`);
          this.lastSeedTick = now;
          await WarmupSeedMessagingService.scheduleSeedMessages();
        }
      }
    } catch (error) {
      warmupLogger.error(`[WarmupCronService] Error evaluating sleep cycle:`, error);
    }
  }
}
