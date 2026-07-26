import { Client, Message } from 'whatsapp-web.js';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupQueue } from '../queues/WarmupQueue';
import { WarmupAsymmetryService } from './WarmupAsymmetryService';
import { WarmupEventTriggerService } from './WarmupEventTriggerService';

export class WarmupIndividualReaderService {
  /**
   * Handles incoming direct messages.
   * If the message is from a direct chat (not a group, not a status, not from the bot itself),
   * enqueues a job to send a read receipt with a realistic human delay.
   */
  static async handleIncomingMessage(instanceId: string, msg: Message, client: Client): Promise<void> {
    try {
      if (!msg.id || !msg.from) return;
      
      const remoteJid = msg.from;
      const fromMe = msg.fromMe;

      // Ignore messages sent by ourselves
      if (fromMe) return;

      // Ignore status and group messages
      if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) return;

      warmupLogger.info(`[WarmupIndividualReader] Bidirectional interaction detected for instance ${instanceId}. Received DM from ${remoteJid}.`);

      // Informa ao avaliador de assimetria que recebemos uma mensagem, melhorando o trust score
      await WarmupAsymmetryService.registerReceivedMessage(instanceId);

      // Avalia a mensagem para disparar eventos como resposta com emoji
      await WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, client);

      // Artificial Jitter: 15s to 3m
      const minJitter = 15 * 1000;
      const maxJitter = 3 * 60 * 1000;
      const delayMs = Math.floor(Math.random() * (maxJitter - minJitter)) + minJitter;

      await WarmupQueue.addIndividualReadJob({
        instanceId,
        messageKey: msg.id
      }, delayMs);

    } catch (error) {
      warmupLogger.error(`[WarmupIndividualReader] Error evaluating incoming DM for instance ${instanceId}:`, error);
    }
  }

  /**
   * Executes the actual read receipt sending.
   */
  static async readMessage(client: Client, messageKey: any): Promise<void> {
    const jid = messageKey.remote;
    if (!jid) return;

    try {
      warmupLogger.info(`[WarmupIndividualReader] Executing read receipt for DM from ${jid}...`);
      
      const readDelay = Math.floor(Math.random() * 2500) + 1500;
      await new Promise((resolve) => setTimeout(resolve, readDelay));
      
      const chat = await client.getChatById(jid);
      await chat.sendSeen();
      warmupLogger.info(`[WarmupIndividualReader] Successfully sent read receipt for DM from ${jid}`);
    } catch (err) {
      warmupLogger.error(`[WarmupIndividualReader] Failed to send read receipt to ${jid}:`, err);
      throw err;
    }
  }
}
