"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupPhaseManagerService = void 0;
const client_1 = require("@prisma/client");
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupProfileService_1 = require("./WarmupProfileService");
const WarmupCacheService_1 = require("./WarmupCacheService");
const prisma = new client_1.PrismaClient();
class WarmupPhaseManagerService {
    /**
     * Avalia todas as instâncias ativas e transiciona as fases e limites diários.
     * Deve ser chamado diariamente (ex: pelo CronJob à meia-noite).
     */
    static async evaluateAllProfiles() {
        try {
            warmupLogger_1.warmupLogger.info(`[WarmupPhaseManager] Starting daily evaluation of warmup profiles...`);
            const profiles = await prisma.warmupProfile.findMany({
                where: { status: client_1.WarmupStatus.WARMING }
            });
            for (const profile of profiles) {
                // Jitter: Atraso aleatório entre 0 e 2000ms para cada conta não estressar o banco simultaneamente
                await new Promise(r => setTimeout(r, Math.random() * 2000));
                await this.evaluateProfile(profile);
            }
            warmupLogger_1.warmupLogger.info(`[WarmupPhaseManager] Finished evaluating ${profiles.length} profiles.`);
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupPhaseManager] Failed to evaluate all profiles:`, error);
        }
    }
    /**
     * Avalia um perfil individual e transiciona de fase/status se necessário.
     */
    static async evaluateProfile(profile) {
        try {
            const msSinceStart = Date.now() - profile.startDate.getTime();
            const chronologicalDays = Math.floor(msSinceStart / (1000 * 60 * 60 * 24)) + 1;
            // Penalidade de Saúde: subtrai dias se a conta foi pausada
            const history = await prisma.warmupStatusHistory.findMany({
                where: { profileId: profile.id }
            });
            let penaltyDays = 0;
            for (const event of history) {
                if (event.newStatus === client_1.WarmupStatus.PAUSED || event.newStatus === client_1.WarmupStatus.COOLING_DOWN) {
                    penaltyDays += 3; // Recua 3 dias para cada falha ou bloqueio registrado
                }
            }
            // Idade Efetiva nunca é menor que 1
            const effectiveDays = Math.max(1, chronologicalDays - penaltyDays);
            let newPhase = profile.currentPhase;
            let newLimit = profile.dailyLimit;
            let newStatus = profile.status;
            // Fase 3 (Scale)
            if (effectiveDays >= 22) {
                newStatus = client_1.WarmupStatus.COMPLETED;
            }
            else if (effectiveDays >= 15) {
                newPhase = client_1.WarmupPhase.PHASE_3;
                if (effectiveDays >= 18)
                    newLimit = 800; // Dia 18-21
                else
                    newLimit = 450; // Dia 15-17
            }
            // Fase 2 (Traction)
            else if (effectiveDays >= 8) {
                newPhase = client_1.WarmupPhase.PHASE_2;
                if (effectiveDays >= 11)
                    newLimit = 200; // Dia 11-14
                else
                    newLimit = 75; // Dia 8-10
            }
            // Fase 1 (Basic Trust)
            else {
                newPhase = client_1.WarmupPhase.PHASE_1;
                if (effectiveDays >= 4)
                    newLimit = 25; // Dia 4-7
                else
                    newLimit = 10; // Dia 1-3
            }
            // Se não mudou nada e não precisa resetar cota, retorna
            // Mas o evaluateProfile deve resetar a cota de messagesSentToday para 0 a cada meia-noite
            if (newStatus !== profile.status) {
                // Transição de Status maior (Ex: WARMING para COMPLETED)
                await WarmupProfileService_1.WarmupProfileService.updateStatus(profile.instanceId.toString(), newStatus, `Effective age reached ${effectiveDays} days (Chronological: ${chronologicalDays}, Penalty: ${penaltyDays}). Warmup completed.`);
            }
            else {
                // Atualiza a fase, limite e reseta contador diário
                await prisma.warmupProfile.update({
                    where: { id: profile.id },
                    data: {
                        currentPhase: newPhase,
                        dailyLimit: newLimit,
                        messagesSentToday: 0
                    }
                });
                // Se a fase mudou, loga a progressão
                if (newPhase !== profile.currentPhase) {
                    warmupLogger_1.warmupLogger.info(`[WarmupPhaseManager] Instance ${profile.instanceId} transitioned to ${newPhase} on effective day ${effectiveDays} (Chronological: ${chronologicalDays}) with limit ${newLimit}`);
                }
                else if (newLimit !== profile.dailyLimit) {
                    warmupLogger_1.warmupLogger.info(`[WarmupPhaseManager] Instance ${profile.instanceId} limit increased to ${newLimit} on effective day ${effectiveDays}`);
                }
                else {
                    warmupLogger_1.warmupLogger.info(`[WarmupPhaseManager] Instance ${profile.instanceId} remained at limit ${newLimit} on effective day ${effectiveDays}`);
                }
            }
            // Reseta estado efêmero diário no Redis
            const state = await WarmupCacheService_1.WarmupCacheService.getState(profile.instanceId.toString());
            if (state) {
                state.messagesSentInCurrentBatch = 0;
                state.messagesReceivedInCurrentBatch = 0;
                await WarmupCacheService_1.WarmupCacheService.setState(profile.instanceId.toString(), state);
            }
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupPhaseManager] Error evaluating profile ${profile.instanceId}:`, error);
        }
    }
}
exports.WarmupPhaseManagerService = WarmupPhaseManagerService;
