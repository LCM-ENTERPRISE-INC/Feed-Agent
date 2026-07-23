import { WASocket, proto } from '@whiskeysockets/baileys';
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
  static async handleIncomingMessage(instanceId: string, msg: proto.IWebMessageInfo, socket: WASocket): Promise<void> {
    try {
      if (!msg.key || !msg.key.remoteJid) return;
      
      const { remoteJid, fromMe } = msg.key;

      // Ignore messages sent by ourselves
      if (fromMe) return;

      // Ignore status and group messages
      if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) return;

      warmupLogger.info(`[WarmupIndividualReader] Bidirectional interaction detected for instance ${instanceId}. Received DM from ${remoteJid}.`);

      // Informa ao avaliador de assimetria que recebemos uma mensagem, melhorando o trust score
      await WarmupAsymmetryService.registerReceivedMessage(instanceId);

      // Avalia a mensagem para disparar eventos como resposta com emoji
      await WarmupEventTriggerService.evaluateIncomingMessage(instanceId, msg, socket);

      // Artificial Jitter: 15s to 3m
      const minJitter = 15 * 1000;
      const maxJitter = 3 * 60 * 1000;
      const delayMs = Math.floor(Math.random() * (maxJitter - minJitter)) + minJitter;

      await WarmupQueue.addIndividualReadJob({
        instanceId,
        messageKey: msg.key
      }, delayMs);

    } catch (error) {
      warmupLogger.error(`[WarmupIndividualReader] Error evaluating incoming DM for instance ${instanceId}:`, error);
    }
  }

  /**
   * Executes the actual read receipt sending via Baileys.
   */
  static async readMessage(socket: WASocket, messageKey: proto.IMessageKey): Promise<void> {
    const jid = messageKey.remoteJid;
    if (!jid) return;

    try {
      warmupLogger.info(`[WarmupIndividualReader] Executing read receipt for DM from ${jid}...`);
      
      // We will just use Baileys to read the message. The WarmupBaileysService already has simulateHumanRead.
      // But wait, simulateHumanRead is already in WarmupBaileysService! So WarmupQueue can just call that.
      // We don't even need this wrapper function if WarmupQueue calls WarmupBaileysService directly, but having it here keeps the pattern consistent.
      
      // Wait, let's just delegate it to socket.readMessages to keep it simple, or use the BaileysService if we want the extra 1.5s delay.
      // I'll leave the actual execution to WarmupBaileysService inside WarmupQueue.
      // So this method might not be strictly needed, but let's implement it for consistency.
      const readDelay = Math.floor(Math.random() * 2500) + 1500;
      await new Promise((resolve) => setTimeout(resolve, readDelay));
      
      await socket.readMessages([messageKey]);
      warmupLogger.info(`[WarmupIndividualReader] Successfully sent read receipt for DM from ${jid}`);
    } catch (err) {
      warmupLogger.error(`[WarmupIndividualReader] Failed to send read receipt to ${jid}:`, err);
      throw err;
    }
  }
}
