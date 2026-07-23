import { WASocket, delay, proto } from '@whiskeysockets/baileys';
import logger from '../../utils/logger';
import { WarmupCacheService } from './WarmupCacheService';
import { WarmupBounceService, HardBounceError } from './WarmupBounceService';

export class WarmupBaileysService {
  /**
   * Simulates a human reading a message by sending a read receipt after a random delay.
   * Jitter: 1500ms to 4000ms
   */
  static async simulateHumanRead(socket: WASocket, jid: string, messageKey: any): Promise<void> {
    const readDelay = Math.floor(Math.random() * 2500) + 1500;
    await delay(readDelay);
    
    try {
      await socket.readMessages([messageKey]);
      logger.info(`[Warmup] Simulate read receipt sent to ${jid}`);
    } catch (err) {
      logger.error(`[Warmup] Failed to send read receipt to ${jid}:`, err);
    }
  }

  /**
   * Simulates a human typing a message.
   * Calculates typing duration based on text length (assuming avg 200 CPM -> ~3.3 chars per sec -> ~300ms per char).
   * Minimum typing time: 1500ms. Maximum: 8000ms (to prevent hanging).
   */
  static async simulateHumanTyping(socket: WASocket, jid: string, textLength: number): Promise<void> {
    const msPerChar = 250 + Math.floor(Math.random() * 100); // 250-350ms per character
    let typingDuration = textLength * msPerChar;
    
    if (typingDuration < 1500) typingDuration = 1500;
    if (typingDuration > 8000) typingDuration = 8000;

    try {
      await socket.presenceSubscribe(jid);
      await delay(500); // Wait briefly before starting to type
      await socket.sendPresenceUpdate('composing', jid);
      
      await delay(typingDuration); // The actual "typing" time
      
      await socket.sendPresenceUpdate('paused', jid);
      await delay(300); // Brief pause before hitting send
    } catch (err) {
      logger.error(`[Warmup] Failed to simulate typing presence for ${jid}:`, err);
    }
  }

  /**
   * Simulates a human recording an audio message.
   * Uses the provided audio duration (or a default) to simulate the 'recording' presence.
   * Adds a small random jitter to the duration.
   */
  static async simulateHumanRecording(socket: WASocket, jid: string, audioDurationMs: number): Promise<void> {
    // Add jitter (user holding the mic a bit longer before/after speaking)
    const jitter = Math.floor(Math.random() * 1500) + 500; // 500ms to 2000ms
    const totalRecordingTime = audioDurationMs + jitter;

    try {
      await socket.presenceSubscribe(jid);
      await delay(500); // Wait briefly before starting to record
      await socket.sendPresenceUpdate('recording', jid);
      
      await delay(totalRecordingTime); // The actual "recording" time
      
      await socket.sendPresenceUpdate('paused', jid);
      await delay(300); // Brief pause before hitting send
    } catch (err) {
      logger.error(`[Warmup] Failed to simulate recording presence for ${jid}:`, err);
    }
  }

  /**
   * Sends a warmup message simulating full human behavior.
   * Returns the message key so it can be deleted later if needed.
   */
  static async sendWarmupMessage(socket: WASocket, jid: string, text: string): Promise<proto.IMessageKey | undefined> {
    logger.info(`[Warmup] Starting warmup message routine to ${jid}`);

    try {
      // Lazy Validation: Só checamos a API se não houver histórico de conversa hoje para economizar requests
      const phone = jid.split('@')[0];
      const hasHistory = await WarmupCacheService.getConversationHistory('shared', phone);
      if (!hasHistory || hasHistory.length === 0) {
        await WarmupBounceService.validateOrRemoveContact(socket, jid);
      }
    } catch (err) {
      if (err instanceof HardBounceError) {
        logger.warn(`[Warmup] Aborting send due to Hard Bounce for ${jid}`);
        throw err;
      }
      logger.error(`[Warmup] Non-fatal error during bounce check for ${jid}:`, err);
    }
    
    await this.simulateHumanTyping(socket, jid, text.length);
    
    try {
      const sentMsg = await socket.sendMessage(jid, { text });
      logger.info(`[Warmup] Message sent successfully to ${jid}`);
      return sentMsg?.key;
    } catch (err) {
      logger.error(`[Warmup] Failed to send warmup message to ${jid}:`, err);
      throw err;
    }
  }

  /**
   * Deletes a message for everyone.
   */
  static async deleteWarmupMessage(socket: WASocket, jid: string, key: proto.IMessageKey): Promise<void> {
    try {
      await socket.sendMessage(jid, { delete: key });
      logger.info(`[Warmup] Message deleted successfully for ${jid}`);
    } catch (err) {
      logger.error(`[Warmup] Failed to delete message to ${jid}:`, err);
    }
  }

  /**
   * Updates the profile picture of the connected WhatsApp instance.
   * Includes an artificial jitter to simulate human delay.
   */
  static async updateProfilePicture(socket: WASocket, imageBuffer: Buffer): Promise<void> {
    logger.info(`[Warmup] Starting profile picture update routine`);
    
    // Artificial jitter: 2 to 5 seconds
    const jitterDelay = Math.floor(Math.random() * 3000) + 2000;
    await delay(jitterDelay);
    
    try {
      // Baileys updateProfilePicture requires the user's JID, which is available in socket.user.id
      if (!socket.user?.id) {
        throw new Error('Socket user ID is not available. Is the instance fully connected?');
      }
      
      const userJid = socket.user.id;
      await socket.updateProfilePicture(userJid, imageBuffer);
      logger.info(`[Warmup] Profile picture updated successfully for ${userJid}`);
    } catch (err) {
      logger.error(`[Warmup] Failed to update profile picture:`, err);
      throw err;
    }
  }

  /**
   * Updates the text status (About/Recado) of the connected WhatsApp instance.
   * Includes jitter and typing simulation delay based on text length.
   */
  static async updateProfileStatus(socket: WASocket, text: string): Promise<void> {
    logger.info(`[Warmup] Starting about status update routine`);
    
    // Artificial jitter: 1.5 to 3 seconds before starting
    const prepDelay = Math.floor(Math.random() * 1500) + 1500;
    await delay(prepDelay);
    
    // Simulate typing the status: 250-350ms per character
    const msPerChar = 250 + Math.floor(Math.random() * 100);
    let typingDuration = text.length * msPerChar;
    
    if (typingDuration < 2000) typingDuration = 2000;
    if (typingDuration > 10000) typingDuration = 10000; // Cap at 10s

    await delay(typingDuration);

    try {
      await socket.updateProfileStatus(text);
      logger.info(`[Warmup] About status updated successfully`);
    } catch (err) {
      logger.error(`[Warmup] Failed to update about status:`, err);
      throw err;
    }
  }
}


