import { WASocket } from '@whiskeysockets/baileys';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupProfileService } from './WarmupProfileService';
import { WarmupQueue } from '../queues/WarmupQueue';
import axios from 'axios';

export class WarmupStatusPublisherService {
  private static CAPTIONS = [
    'Bom dia! ☀️',
    'Ótima semana a todos! 🙏',
    'Vamos pra cima!',
    'Café e foco! ☕',
    'Bom dia, mundo!',
    'Mais um dia de vitória!'
  ];

  /**
   * Called in the morning when the Cron wakes up the instances.
   * Schedules a daily status post for each active instance with a jitter.
   */
  static async scheduleMorningStatuses(): Promise<void> {
    try {
      warmupLogger.info(`[WarmupStatusPublisher] Scheduling morning statuses for all active instances...`);
      const profiles = await WarmupProfileService.getActiveProfiles();

      for (const profile of profiles) {
        // Jitter: 5 to 45 minutes
        const minJitter = 5 * 60 * 1000;
        const maxJitter = 45 * 60 * 1000;
        const delayMs = Math.floor(Math.random() * (maxJitter - minJitter)) + minJitter;

        await WarmupQueue.addStatusPostJob({
          instanceId: profile.instanceId.toString()
        }, delayMs);
      }

      warmupLogger.info(`[WarmupStatusPublisher] Successfully scheduled statuses for ${profiles.length} instances.`);
    } catch (err) {
      warmupLogger.error(`[WarmupStatusPublisher] Failed to schedule morning statuses:`, err);
    }
  }

  /**
   * Executes the actual post via Baileys.
   */
  static async executeStatusPost(socket: WASocket, instanceId: string): Promise<void> {
    try {
      warmupLogger.info(`[WarmupStatusPublisher] Executing daily status post for instance ${instanceId}...`);
      
      // Fetch a random landscape image from Picsum
      // We use the instanceId in the seed to get a unique image per instance per cache (though picsum randomness is fine too)
      const imageUrl = `https://picsum.photos/seed/${instanceId}-${Date.now()}/800/600`;
      
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');

      const randomCaption = this.CAPTIONS[Math.floor(Math.random() * this.CAPTIONS.length)];

      await socket.sendMessage('status@broadcast', {
        image: buffer,
        caption: randomCaption
      });

      warmupLogger.info(`[WarmupStatusPublisher] Status successfully posted for instance ${instanceId}`);
    } catch (err) {
      warmupLogger.error(`[WarmupStatusPublisher] Failed to post status for instance ${instanceId}:`, err);
      throw err;
    }
  }
}
