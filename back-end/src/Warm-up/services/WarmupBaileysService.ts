import { Client, MessageMedia } from 'whatsapp-web.js';
import logger from '../../utils/logger';
import { WarmupCacheService } from './WarmupCacheService';
import { WarmupBounceService, HardBounceError } from './WarmupBounceService';

// Helper function to simulate delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class WarmupBaileysService {
  /**
   * Simulates a human reading a message by sending a read receipt after a random delay.
   * Jitter: 1500ms to 4000ms
   */
  static async simulateHumanRead(client: Client, jid: string, messageKey: any): Promise<void> {
    const readDelay = Math.floor(Math.random() * 2500) + 1500;
    await delay(readDelay);
    
    try {
      // In whatsapp-web.js, we can send seen to the chat
      const chat = await client.getChatById(jid);
      await chat.sendSeen();
      logger.info(`[Warmup] Simulate read receipt sent to ${jid}`);
    } catch (err) {
      logger.error(`[Warmup] Failed to send read receipt to ${jid}:`, err);
    }
  }

  static async simulateHumanTyping(client: Client, jid: string, textLength: number): Promise<void> {
    const msPerChar = 200 + Math.floor(Math.random() * 150); // 200-350ms per character
    let totalTypingTime = textLength * msPerChar;
    
    if (totalTypingTime < 1500) totalTypingTime = 1500;
    if (totalTypingTime > 25000) totalTypingTime = 25000;

    try {
      const chat = await client.getChatById(jid);
      await delay(500 + Math.floor(Math.random() * 1000));
      
      if (totalTypingTime <= 3000) {
        await chat.sendStateTyping();
        await delay(totalTypingTime);
        await chat.clearState();
      } else {
        let remainingTime = totalTypingTime;
        
        while (remainingTime > 0) {
          await chat.sendStateTyping();
          
          const chunkTime = Math.min(remainingTime, Math.floor(Math.random() * 4000) + 2000);
          await delay(chunkTime);
          remainingTime -= chunkTime;
          
          if (remainingTime > 0) {
            await chat.clearState();
            const pauseTime = Math.floor(Math.random() * 2000) + 500;
            await delay(pauseTime);
            
            if (Math.random() < 0.25) {
               await delay(Math.floor(Math.random() * 1500) + 1000);
            }
          }
        }
      }
      
      await chat.clearState();
      await delay(Math.floor(Math.random() * 600) + 200);
    } catch (err) {
      logger.error(`[Warmup] Failed to simulate typing presence for ${jid}:`, err);
    }
  }

  /**
   * Simulates a human opening the app and navigating to a chat to see if their message was read.
   */
  static async simulateCheckingSentMessage(client: Client, jid: string): Promise<void> {
    logger.info(`[Warmup] Simulating human checking sent message in chat ${jid}`);
    try {
      await client.sendPresenceAvailable();
      const stareTime = Math.floor(Math.random() * 6000) + 2000;
      await delay(stareTime);
    } catch (err) {
      logger.error(`[Warmup] Failed to simulate checking sent message for ${jid}:`, err);
    }
  }

  /**
   * Simulates a human recording an audio message.
   */
  static async simulateHumanRecording(client: Client, jid: string, audioDurationMs: number): Promise<void> {
    const jitter = Math.floor(Math.random() * 1500) + 500;
    const totalRecordingTime = audioDurationMs + jitter;

    try {
      const chat = await client.getChatById(jid);
      await delay(500);
      await chat.sendStateRecording();
      
      await delay(totalRecordingTime);
      
      await chat.clearState();
      await delay(300);
    } catch (err) {
      logger.error(`[Warmup] Failed to simulate recording presence for ${jid}:`, err);
    }
  }

  /**
   * Sends a warmup message simulating full human behavior.
   * Returns the message ID string so it can be deleted later if needed.
   */
  static async sendWarmupMessage(client: Client, jid: string, text: string): Promise<string | undefined> {
    logger.info(`[Warmup] Starting warmup message routine to ${jid}`);

    try {
      const phone = jid.split('@')[0];
      const hasHistory = await WarmupCacheService.getConversationHistory('shared', phone);
      if (!hasHistory || hasHistory.length === 0) {
        await WarmupBounceService.validateOrRemoveContact(client, jid);
      }
    } catch (err) {
      if (err instanceof HardBounceError) {
        logger.warn(`[Warmup] Aborting send due to Hard Bounce for ${jid}`);
        throw err;
      }
      logger.error(`[Warmup] Non-fatal error during bounce check for ${jid}:`, err);
    }
    
    await this.simulateHumanTyping(client, jid, text.length);
    
    try {
      const sentMsg = await client.sendMessage(jid, text);
      logger.info(`[Warmup] Message sent successfully to ${jid}`);
      return sentMsg.id.id; // Return the message ID
    } catch (err) {
      logger.error(`[Warmup] Failed to send warmup message to ${jid}:`, err);
      throw err;
    }
  }

  /**
   * Deletes a message for everyone.
   */
  static async deleteWarmupMessage(client: Client, jid: string, key: any): Promise<void> {
    try {
      // In whatsapp-web.js, we need the message object to delete it, or we can use getMessageById if we know it
      // key here is actually the message id we returned in sendWarmupMessage
      const chat = await client.getChatById(jid);
      const messages = await chat.fetchMessages({ limit: 20 });
      const msgToDelete = messages.find(m => m.id.id === key);
      
      if (msgToDelete) {
        await msgToDelete.delete(true);
        logger.info(`[Warmup] Message deleted successfully for ${jid}`);
      } else {
        logger.warn(`[Warmup] Message to delete not found in recent history for ${jid}`);
      }
    } catch (err) {
      logger.error(`[Warmup] Failed to delete message to ${jid}:`, err);
    }
  }

  /**
   * Updates the profile picture of the connected WhatsApp instance.
   */
  static async updateProfilePicture(client: Client, imageBuffer: Buffer): Promise<void> {
    logger.info(`[Warmup] Starting profile picture update routine`);
    
    const jitterDelay = Math.floor(Math.random() * 3000) + 2000;
    await delay(jitterDelay);
    
    try {
      const media = new MessageMedia('image/jpeg', imageBuffer.toString('base64'));
      await client.setProfilePicture(media);
      logger.info(`[Warmup] Profile picture updated successfully`);
    } catch (err) {
      logger.error(`[Warmup] Failed to update profile picture:`, err);
      throw err;
    }
  }

  /**
   * Updates the text status (About/Recado) of the connected WhatsApp instance.
   */
  static async updateProfileStatus(client: Client, text: string): Promise<void> {
    logger.info(`[Warmup] Starting about status update routine`);
    
    const prepDelay = Math.floor(Math.random() * 1500) + 1500;
    await delay(prepDelay);
    
    const msPerChar = 250 + Math.floor(Math.random() * 100);
    let typingDuration = text.length * msPerChar;
    
    if (typingDuration < 2000) typingDuration = 2000;
    if (typingDuration > 10000) typingDuration = 10000;

    await delay(typingDuration);

    try {
      await client.setStatus(text);
      logger.info(`[Warmup] About status updated successfully`);
    } catch (err) {
      logger.error(`[Warmup] Failed to update about status:`, err);
      throw err;
    }
  }
}



