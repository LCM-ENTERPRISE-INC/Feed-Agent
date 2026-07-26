"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupEventTriggerService = void 0;
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupQueue_1 = require("../queues/WarmupQueue");
const LlamaService_1 = __importDefault(require("../../services/LlamaService"));
const WarmupPersonaService_1 = require("./WarmupPersonaService");
const WarmupCacheService_1 = require("./WarmupCacheService");
const WarmupAIFilterService_1 = require("./WarmupAIFilterService");
const WarmupTypoService_1 = require("./WarmupTypoService");
const WarmupAuditService_1 = require("./WarmupAuditService");
const WarmupProfileService_1 = require("./WarmupProfileService");
const WarmupJitterService_1 = require("./WarmupJitterService");
class WarmupEventTriggerService {
    /**
     * Avalia a mensagem recebida e decide se deve acionar um gatilho de resposta (ex: emoji '👍').
     */
    static async evaluateIncomingMessage(instanceId, msg, _client) {
        try {
            if (!msg.id || !msg.from)
                return;
            const remoteJid = msg.from;
            const fromMe = msg.fromMe;
            if (fromMe)
                return; // Não responde a si mesmo
            if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us'))
                return;
            const text = msg.body;
            if (!text || text.length < 2)
                return;
            // Drop rate de 20% para evitar loops infinitos entre bots
            if (Math.random() < 0.20) {
                warmupLogger_1.warmupLogger.info(`[WarmupEventTrigger] Natural drop (20% chance). Ignoring message from ${remoteJid} on instance ${instanceId}.`);
                return;
            }
            warmupLogger_1.warmupLogger.info(`[WarmupEventTrigger] Received text from ${remoteJid} on instance ${instanceId}. Evaluating with AI...`);
            // Extract phone number from JID (e.g. 5511999999999@c.us)
            const contactPhone = remoteJid.split('@')[0];
            // Auditoria: Gravamos a recepção da mensagem organicamente no MongoDB
            WarmupAuditService_1.WarmupAuditService.logInteraction({
                instanceId,
                contactJid: remoteJid,
                direction: 'RECEIVED',
                content: text,
                isAiGenerated: false
            });
            // Salva a mensagem recebida no histórico e puxa o contexto
            await WarmupCacheService_1.WarmupCacheService.appendConversationHistory(instanceId, contactPhone, text, 'other');
            const history = await WarmupCacheService_1.WarmupCacheService.getConversationHistory(instanceId, contactPhone);
            let replyContent = '👍';
            try {
                const prompt = WarmupPersonaService_1.WarmupPersonaService.getReplyPrompt(text, history);
                const systemPrompt = WarmupPersonaService_1.WarmupPersonaService.getSystemPrompt();
                replyContent = await LlamaService_1.default.generateCompletion(prompt, systemPrompt, { max_tokens: 40 });
                replyContent = WarmupAIFilterService_1.WarmupAIFilterService.validate(replyContent, 'reply');
            }
            catch (aiError) {
                warmupLogger_1.warmupLogger.warn(`[WarmupEventTrigger] AI evaluation failed, using static fallback (thumbs up) for instance ${instanceId}. Error: ${aiError}`);
                // Fallback to emoji if text contains some positive keyword
                const positiveKeywords = /\b(sim|ok|beleza|tranquilo|tá|tudo|ótimo|bom|joia|show)\b/i;
                if (!positiveKeywords.test(text.trim())) {
                    return; // If AI failed and it's not a simple positive keyword, don't reply to avoid weirdness
                }
            }
            if (!replyContent)
                replyContent = '👍';
            // Buscar Fase e Limite Diário
            const profile = await WarmupProfileService_1.WarmupProfileService.getProfile(instanceId);
            const state = await WarmupCacheService_1.WarmupCacheService.getState(instanceId);
            const failureCount = state?.consecutiveFailures || 0;
            // Artificial Jitter dinâmico baseado na Fase e Escala
            const delayMs = WarmupJitterService_1.WarmupJitterService.getDelayForPhase(profile.currentPhase, failureCount, profile.dailyLimit);
            // Apply typo simulation
            const { text: typoReply, correction } = WarmupTypoService_1.WarmupTypoService.generateTypo(replyContent);
            const shouldDelete = WarmupTypoService_1.WarmupTypoService.shouldDelete();
            // Enfileira o job de resposta a evento
            await WarmupQueue_1.WarmupQueue.addEventReplyJob({
                instanceId,
                targetJid: remoteJid,
                content: typoReply,
                correction,
                shouldDelete
            }, delayMs);
            // Salva a resposta gerada no histórico (como 'me')
            await WarmupCacheService_1.WarmupCacheService.appendConversationHistory(instanceId, contactPhone, typoReply, 'me');
            if (correction) {
                await WarmupCacheService_1.WarmupCacheService.appendConversationHistory(instanceId, contactPhone, correction, 'me');
            }
            warmupLogger_1.warmupLogger.info(`[WarmupEventTrigger] Queued AI reply for ${remoteJid}: "${typoReply}" with jitter ${delayMs}ms`);
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupEventTrigger] Error evaluating incoming message for instance ${instanceId}:`, error);
        }
    }
}
exports.WarmupEventTriggerService = WarmupEventTriggerService;
