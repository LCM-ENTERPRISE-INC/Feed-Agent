"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupStatusPublisherService = void 0;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupProfileService_1 = require("./WarmupProfileService");
const WarmupQueue_1 = require("../queues/WarmupQueue");
const axios_1 = __importDefault(require("axios"));
class WarmupStatusPublisherService {
    static CAPTIONS = [
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
    static async scheduleMorningStatuses() {
        try {
            warmupLogger_1.warmupLogger.info(`[WarmupStatusPublisher] Scheduling morning statuses for all active instances...`);
            const profiles = await WarmupProfileService_1.WarmupProfileService.getActiveProfiles();
            for (const profile of profiles) {
                // Jitter: 5 to 45 minutes
                const minJitter = 5 * 60 * 1000;
                const maxJitter = 45 * 60 * 1000;
                const delayMs = Math.floor(Math.random() * (maxJitter - minJitter)) + minJitter;
                await WarmupQueue_1.WarmupQueue.addStatusPostJob({
                    instanceId: profile.instanceId.toString()
                }, delayMs);
            }
            warmupLogger_1.warmupLogger.info(`[WarmupStatusPublisher] Successfully scheduled statuses for ${profiles.length} instances.`);
        }
        catch (err) {
            warmupLogger_1.warmupLogger.error(`[WarmupStatusPublisher] Failed to schedule morning statuses:`, err);
        }
    }
    /**
     * Executes the actual post.
     */
    static async executeStatusPost(client, instanceId) {
        try {
            warmupLogger_1.warmupLogger.info(`[WarmupStatusPublisher] Executing daily status post for instance ${instanceId}...`);
            // Fetch a random landscape image from Picsum
            // We use the instanceId in the seed to get a unique image per instance per cache (though picsum randomness is fine too)
            const imageUrl = `https://picsum.photos/seed/${instanceId}-${Date.now()}/800/600`;
            const response = await axios_1.default.get(imageUrl, { responseType: 'arraybuffer' });
            const base64Image = Buffer.from(response.data, 'binary').toString('base64');
            const media = new whatsapp_web_js_1.MessageMedia('image/jpeg', base64Image, 'status.jpg');
            const randomCaption = this.CAPTIONS[Math.floor(Math.random() * this.CAPTIONS.length)];
            await client.sendMessage('status@broadcast', media, {
                caption: randomCaption
            });
            warmupLogger_1.warmupLogger.info(`[WarmupStatusPublisher] Status successfully posted for instance ${instanceId}`);
        }
        catch (err) {
            warmupLogger_1.warmupLogger.error(`[WarmupStatusPublisher] Failed to post status for instance ${instanceId}:`, err);
            throw err;
        }
    }
}
exports.WarmupStatusPublisherService = WarmupStatusPublisherService;
