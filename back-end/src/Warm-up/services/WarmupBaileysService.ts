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

  static async simulateHumanTyping(socket: WASocket, jid: string, textLength: number): Promise<void> {
    const msPerChar = 200 + Math.floor(Math.random() * 150); // 200-350ms per character
    let totalTypingTime = textLength * msPerChar;
    
    // Limits to prevent queue blocking forever, but long enough for realism
    if (totalTypingTime < 1500) totalTypingTime = 1500;
    if (totalTypingTime > 25000) totalTypingTime = 25000; // Cap at 25 seconds for extremely long texts

    try {
      await socket.presenceSubscribe(jid);
      await delay(500 + Math.floor(Math.random() * 1000)); // Wait 0.5s to 1.5s before starting to type
      
      if (totalTypingTime <= 3000) {
        // Small message, just type straight through
        await socket.sendPresenceUpdate('composing', jid);
        await delay(totalTypingTime);
      } else {
        // Longer message, break into chunks with natural pauses (thinking, correcting typos)
        let remainingTime = totalTypingTime;
        
        while (remainingTime > 0) {
          await socket.sendPresenceUpdate('composing', jid);
          
          // Type for a chunk of 2s to 6s, or whatever is left
          const chunkTime = Math.min(remainingTime, Math.floor(Math.random() * 4000) + 2000);
          await delay(chunkTime);
          remainingTime -= chunkTime;
          
          if (remainingTime > 0) {
            // Introduce a human pause
            await socket.sendPresenceUpdate('paused', jid);
            const pauseTime = Math.floor(Math.random() * 2000) + 500; // 0.5s to 2.5s pause
            await delay(pauseTime);
            
            // 25% chance of a "correction" penalty (simulating backspacing/rewriting)
            if (Math.random() < 0.25) {
               // We don't send composing here, just delay to simulate time spent erasing
               // Or we can send composing to simulate re-typing. We will send composing and add to remaining time?
               // Actually, it's easier to just wait a bit longer to simulate the friction of correcting an error.
               await delay(Math.floor(Math.random() * 1500) + 1000); // extra 1s to 2.5s
            }
          }
        }
      }
      
      await socket.sendPresenceUpdate('paused', jid);
      await delay(Math.floor(Math.random() * 600) + 200); // Brief pause before hitting send (0.2s - 0.8s)
    } catch (err) {
      logger.error(`[Warmup] Failed to simulate typing presence for ${jid}:`, err);
    }
  }

  /**
   * Simulates a human opening the app and navigating to a chat to see if their message was read.
   * This sends a presence update of 'available' for a few seconds.
   */
  static async simulateCheckingSentMessage(socket: WASocket, jid: string): Promise<void> {
    logger.info(`[Warmup] Simulating human checking sent message in chat ${jid}`);
    try {
      await socket.presenceSubscribe(jid);
      await delay(Math.floor(Math.random() * 500) + 200);
      
      await socket.sendPresenceUpdate('available', jid);
      
      // Simulate reading/staring at the chat for 2 to 8 seconds
      const stareTime = Math.floor(Math.random() * 6000) + 2000;
      await delay(stareTime);
      
      await socket.sendPresenceUpdate('paused', jid);
    } catch (err) {
      logger.error(`[Warmup] Failed to simulate checking sent message for ${jid}:`, err);
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


