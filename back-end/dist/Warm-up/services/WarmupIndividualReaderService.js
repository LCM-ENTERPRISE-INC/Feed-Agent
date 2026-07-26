"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupIndividualReaderService = void 0;
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupQueue_1 = require("../queues/WarmupQueue");
const WarmupAsymmetryService_1 = require("./WarmupAsymmetryService");
const WarmupEventTriggerService_1 = require("./WarmupEventTriggerService");
class WarmupIndividualReaderService {
    /**
     * Handles incoming direct messages.
     * If the message is from a direct chat (not a group, not a status, not from the bot itself),
     * enqueues a job to send a read receipt with a realistic human delay.
     */
    static async handleIncomingMessage(instanceId, msg, client) {
        try {
            if (!msg.id || !msg.from)
                return;
            const remoteJid = msg.from;
            const fromMe = msg.fromMe;
            // Ignore messages sent by ourselves
            if (fromMe)
                return;
            // Ignore status and group messages
            if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us'))
                return;
            warmupLogger_1.warmupLogger.info(`[WarmupIndividualReader] Bidirectional interaction detected for instance ${instanceId}. Received DM from ${remoteJid}.`);
            // Informa ao avaliador de assimetria que recebemos uma mensagem, melhorando o trust score
            await WarmupAsymmetryService_1.WarmupAsymmetryService.registerReceivedMessage(instanceId);
            // Avalia a mensagem para disparar eventos como resposta com emoji
            await WarmupEventTriggerService_1.WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, client);
            // Artificial Jitter: 15s to 3m
            const minJitter = 15 * 1000;
            const maxJitter = 3 * 60 * 1000;
            const delayMs = Math.floor(Math.random() * (maxJitter - minJitter)) + minJitter;
            await WarmupQueue_1.WarmupQueue.addIndividualReadJob({
                instanceId,
                messageKey: msg.id
            }, delayMs);
        }
        catch (error) {
            warmupLogger_1.warmupLogger.error(`[WarmupIndividualReader] Error evaluating incoming DM for instance ${instanceId}:`, error);
        }
    }
    /**
     * Executes the actual read receipt sending.
     */
    static async readMessage(client, messageKey) {
        const jid = messageKey.remote;
        if (!jid)
            return;
        try {
            warmupLogger_1.warmupLogger.info(`[WarmupIndividualReader] Executing read receipt for DM from ${jid}...`);
            const readDelay = Math.floor(Math.random() * 2500) + 1500;
            await new Promise((resolve) => setTimeout(resolve, readDelay));
            const chat = await client.getChatById(jid);
            await chat.sendSeen();
            warmupLogger_1.warmupLogger.info(`[WarmupIndividualReader] Successfully sent read receipt for DM from ${jid}`);
        }
        catch (err) {
            warmupLogger_1.warmupLogger.error(`[WarmupIndividualReader] Failed to send read receipt to ${jid}:`, err);
            throw err;
        }
    }
}
exports.WarmupIndividualReaderService = WarmupIndividualReaderService;
