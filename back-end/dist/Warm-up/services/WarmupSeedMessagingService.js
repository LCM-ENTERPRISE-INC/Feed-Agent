"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupSeedMessagingService = void 0;
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupProfileService_1 = require("./WarmupProfileService");
const WarmupSeedContactService_1 = require("./WarmupSeedContactService");
const WarmupCacheService_1 = require("./WarmupCacheService");
const WarmupQueue_1 = require("../queues/WarmupQueue");
const WarmupBaileysService_1 = require("./WarmupBaileysService");
const LlamaService_1 = __importDefault(require("../../services/LlamaService"));
const WarmupPersonaService_1 = require("./WarmupPersonaService");
const WarmupAIFilterService_1 = require("./WarmupAIFilterService");
const WarmupTypoService_1 = require("./WarmupTypoService");
const WarmupAuditService_1 = require("./WarmupAuditService");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
class WarmupSeedMessagingService {
    static QUESTIONS = [
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
    static async scheduleSeedMessages() {
        try {
            warmupLogger_1.warmupLogger.info(`[WarmupSeedMessaging] Evaluating seed messages for all active instances...`);
            const profiles = await WarmupProfileService_1.WarmupProfileService.getActiveProfiles();
            if (profiles.length === 0) {
                warmupLogger_1.warmupLogger.info(`[WarmupSeedMessaging] No active profiles found, skipping...`);
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
                warmupLogger_1.warmupLogger.warn(`[WarmupSeedMessaging] Heavy load detected! Interval clamped to 3s for ${profiles.length} profiles.`);
            }
            // Shuffle profiles para garantir que a ordem mude a cada hora
            const shuffledProfiles = [...profiles].sort(() => Math.random() - 0.5);
            for (let i = 0; i < shuffledProfiles.length; i++) {
                const profile = shuffledProfiles[i];
                const seedContacts = await WarmupSeedContactService_1.WarmupSeedContactService.listSeedContacts(profile.instanceId.toString());
                if (seedContacts.length === 0) {
                    warmupLogger_1.warmupLogger.info(`[WarmupSeedMessaging] No seed contacts for instance ${profile.instanceId}, skipping...`);
                    continue;
                }
                // Pick one random seed contact
                const randomContact = seedContacts[Math.floor(Math.random() * seedContacts.length)];
                // O bloco de tempo "reservado" para esta instância
                const slotStartMs = baseStartMs + (i * intervalMs);
                // Micro-Jitter (aleatoriedade dentro do bloco, entre 10% e 90% do bloco)
                const jitterOffsetMs = Math.floor(intervalMs * 0.1) + Math.floor(Math.random() * (intervalMs * 0.8));
                const delayMs = slotStartMs + jitterOffsetMs;
                await WarmupQueue_1.WarmupQueue.addSeedMessageJob({
                    instanceId: profile.instanceId.toString(),
                    seedPhone: randomContact.phoneNumber
                }, delayMs);
            }
            warmupLogger_1.warmupLogger.info(`[WarmupSeedMessaging] Successfully distributed seed messages for ${profiles.length} profiles.`);
        }
        catch (err) {
            warmupLogger_1.warmupLogger.error(`[WarmupSeedMessaging] Failed to schedule seed messages:`, err);
        }
    }
    /**
     * Executes the actual message sending.
     */
    static async executeSeedMessage(client, instanceId, seedPhone) {
        try {
            warmupLogger_1.warmupLogger.info(`[WarmupSeedMessaging] Executing seed message for instance ${instanceId} to ${seedPhone}...`);
            let messageToSend = '';
            try {
                const prompt = WarmupPersonaService_1.WarmupPersonaService.getSeedMessagePrompt();
                const systemPrompt = WarmupPersonaService_1.WarmupPersonaService.getSystemPrompt();
                messageToSend = await LlamaService_1.default.generateCompletion(prompt, systemPrompt, { max_tokens: 30 });
                messageToSend = WarmupAIFilterService_1.WarmupAIFilterService.validate(messageToSend, 'seed');
            }
            catch (aiError) {
                warmupLogger_1.warmupLogger.warn(`[WarmupSeedMessaging] AI generation failed, using static fallback for instance ${instanceId}. Error: ${aiError}`);
                messageToSend = this.QUESTIONS[Math.floor(Math.random() * this.QUESTIONS.length)];
            }
            if (!messageToSend) {
                messageToSend = this.QUESTIONS[Math.floor(Math.random() * this.QUESTIONS.length)];
            }
            // Apply typo simulation
            const { text, correction } = WarmupTypoService_1.WarmupTypoService.generateTypo(messageToSend);
            const shouldDelete = WarmupTypoService_1.WarmupTypoService.shouldDelete();
            const jid = `${seedPhone}@c.us`;
            const sentKey = await WarmupBaileysService_1.WarmupBaileysService.sendWarmupMessage(client, jid, text);
            if (shouldDelete && sentKey) {
                warmupLogger_1.warmupLogger.info(`[WarmupSeedMessaging] Simulating regret! Deleting message for ${seedPhone}...`);
                await delay(Math.floor(Math.random() * 3000) + 2000); // Wait 2-5s
                await WarmupBaileysService_1.WarmupBaileysService.deleteWarmupMessage(client, jid, sentKey);
                WarmupAuditService_1.WarmupAuditService.logInteraction({
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
            await WarmupCacheService_1.WarmupCacheService.appendConversationHistory(instanceId, seedPhone, text, 'me');
            WarmupAuditService_1.WarmupAuditService.logInteraction({
                instanceId,
                contactJid: jid,
                direction: 'SENT',
                content: text,
                isAiGenerated: true,
                metadata: { typoSimulated: !!correction }
            });
            warmupLogger_1.warmupLogger.info(`[WarmupSeedMessaging] Seed message successfully sent for instance ${instanceId} to ${seedPhone}. Text: "${text}"`);
            // Se houver correção ortográfica a fazer
            if (correction) {
                warmupLogger_1.warmupLogger.info(`[WarmupSeedMessaging] Sending typo correction: "${correction}" for instance ${instanceId}`);
                await delay(Math.floor(Math.random() * 2000) + 1000); // 1-3s delay to realize the mistake
                await WarmupBaileysService_1.WarmupBaileysService.sendWarmupMessage(client, jid, correction);
                await WarmupCacheService_1.WarmupCacheService.appendConversationHistory(instanceId, seedPhone, correction, 'me');
                WarmupAuditService_1.WarmupAuditService.logInteraction({
                    instanceId,
                    contactJid: jid,
                    direction: 'SENT',
                    content: correction,
                    isAiGenerated: false,
                    metadata: { isCorrection: true }
                });
            }
        }
        catch (err) {
            warmupLogger_1.warmupLogger.error(`[WarmupSeedMessaging] Failed to send seed message for instance ${instanceId}:`, err);
            throw err;
        }
    }
}
exports.WarmupSeedMessagingService = WarmupSeedMessagingService;
