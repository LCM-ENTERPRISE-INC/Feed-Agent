"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupCronService = void 0;
const WarmupBusinessHoursService_1 = require("./WarmupBusinessHoursService");
const WarmupQueue_1 = require("../queues/WarmupQueue");
const WarmupStatusPublisherService_1 = require("./WarmupStatusPublisherService");
const WarmupSeedMessagingService_1 = require("./WarmupSeedMessagingService");
const WarmupPhaseManagerService_1 = require("./WarmupPhaseManagerService");
const WarmupCleanupService_1 = require("./WarmupCleanupService");
const warmupLogger_1 = require("../utils/warmupLogger");
class WarmupCronService {
    static timer = null;
    static isCurrentlyPaused = false;
    static lastSeedTick = 0;
    static lastPhaseTick = 0;
    /**
     * Starts the internal polling cron that checks business hours every minute.
     * If it detects off-hours, it halts the entire warmup queue.
     */
    static startBusinessHoursCron() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        warmupLogger_1.warmupLogger.info(`[WarmupCronService] Starting business hours monitoring cron...`);
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
            warmupLogger_1.warmupLogger.info(`[WarmupCronService] Business hours monitoring cron stopped.`);
        }
    }
    static async evaluateSleepCycle() {
        try {
            const now = Date.now();
            // Avaliação Diária de Fases e Limites (Roda uma vez a cada 24h)
            if (now - this.lastPhaseTick > 24 * 60 * 60 * 1000) {
                // Alinhando para rodar preferencialmente na primeira checagem do dia
                this.lastPhaseTick = now;
                warmupLogger_1.warmupLogger.info(`[WarmupCronService] Triggering daily phase evaluation and cleanup...`);
                await WarmupPhaseManagerService_1.WarmupPhaseManagerService.evaluateAllProfiles();
                // Dispara limpeza de cache em background (sem await para não travar o cron)
                WarmupCleanupService_1.WarmupCleanupService.runDailyCleanup().catch(err => {
                    warmupLogger_1.warmupLogger.error(`[WarmupCronService] Failed to run daily cleanup:`, err);
                });
            }
            const isBusinessHours = WarmupBusinessHoursService_1.WarmupBusinessHoursService.isBusinessHours();
            if (!isBusinessHours && !this.isCurrentlyPaused) {
                warmupLogger_1.warmupLogger.info(`[WarmupCronService] Off-hours detected. Putting Warmup to sleep...`);
                await WarmupQueue_1.WarmupQueue.pauseQueue();
                this.isCurrentlyPaused = true;
            }
            else if (isBusinessHours && this.isCurrentlyPaused) {
                warmupLogger_1.warmupLogger.info(`[WarmupCronService] Business hours started. Waking up Warmup...`);
                await WarmupQueue_1.WarmupQueue.resumeQueue();
                this.isCurrentlyPaused = false;
                // Schedule morning statuses for everyone who woke up
                await WarmupStatusPublisherService_1.WarmupStatusPublisherService.scheduleMorningStatuses();
            }
            // Every 1 hour during business hours, evaluate seed messages
            if (isBusinessHours) {
                const now = Date.now();
                if (now - this.lastSeedTick > 60 * 60 * 1000) {
                    warmupLogger_1.warmupLogger.info(`[WarmupCronService] Hourly seed message tick triggered.`);
                    this.lastSeedTick = now;
                    await WarmupSeedMessagingService_1.WarmupSeedMessagingService.scheduleSeedMessages();
                }
            }
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupCronService] Error evaluating sleep cycle:`, error);
        }
    }
}
exports.WarmupCronService = WarmupCronService;
