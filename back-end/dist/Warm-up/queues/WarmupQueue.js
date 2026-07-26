"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupQueue = void 0;
const bullmq_1 = require("bullmq");
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const warmupLogger_1 = require("../utils/warmupLogger");
const WarmupBaileysService_1 = require("../services/WarmupBaileysService");
const WarmupCacheService_1 = require("../services/WarmupCacheService");
const WarmupAuditService_1 = require("../services/WarmupAuditService");
const WarmupBackoffService_1 = require("../services/WarmupBackoffService");
const WarmupBounceService_1 = require("../services/WarmupBounceService");
const WarmupRateLimiterService_1 = require("../services/WarmupRateLimiterService");
const WarmupStatusViewerService_1 = require("../services/WarmupStatusViewerService");
const WarmupGroupReaderService_1 = require("../services/WarmupGroupReaderService");
const WarmupStatusPublisherService_1 = require("../services/WarmupStatusPublisherService");
const WarmupSeedMessagingService_1 = require("../services/WarmupSeedMessagingService");
const WarmupProfileService_1 = require("../services/WarmupProfileService");
const WarmupAsymmetryService_1 = require("../services/WarmupAsymmetryService");
const WarmupFallbackService_1 = require("../services/WarmupFallbackService");
const WhatsAppInstanceManager_1 = __importDefault(require("../../services/WhatsAppInstanceManager"));
const boom_1 = require("@hapi/boom");
const ioredis_1 = __importDefault(require("ioredis"));
// Shared redis connection for BullMQ
const redisConnection = new ioredis_1.default(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: null,
});
const QUEUE_NAME = 'warmup-message-queue';
class WarmupQueue {
    static queue = new bullmq_1.Queue(QUEUE_NAME, {
        connection: redisConnection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000, // 5s, 10s, 20s...
            },
            removeOnComplete: true,
            removeOnFail: false, // Keep failed jobs for inspection
        },
    });
    static worker;
    /**
     * Initializes the Worker to process warmup jobs.
     * Concurrency is 1 to naturally funnel the requests and respect WhatsApp pacing per instance.
     */
    static initWorker() {
        if (this.worker)
            return;
        this.worker = new bullmq_1.Worker(QUEUE_NAME, async (job) => {
            const { instanceId } = job.data;
            warmupLogger_1.warmupLogger.info(`[WarmupQueue] Processing job ${job.id} for instance ${instanceId}`);
            const whatsappInstance = WhatsAppInstanceManager_1.default.getInstance(parseInt(instanceId, 10));
            const client = whatsappInstance?.getClient();
            if (!whatsappInstance || !client) {
                throw new boom_1.Boom(`WhatsApp client not connected for instance ${instanceId}`, { statusCode: 400 });
            }
            // Check Rate Limits (Safety Net)
            const profile = await WarmupProfileService_1.WarmupProfileService.getProfile(instanceId);
            if (!profile) {
                throw new boom_1.Boom(`Warmup profile not found for instance ${instanceId}`, { statusCode: 404 });
            }
            // Specific handling for status viewing
            if (job.data.type === 'status_view') {
                try {
                    await WarmupStatusViewerService_1.WarmupStatusViewerService.viewStatus(client, job.data.messageKey);
                    warmupLogger_1.warmupLogger.info(`[WarmupQueue] Successfully processed status view job ${job.id} for instance ${instanceId}`);
                    return;
                }
                catch (error) {
                    warmupLogger_1.warmupLogger.error(`[WarmupQueue] Failed to process status view job ${job.id}`, error);
                    throw error;
                }
            }
            // Specific handling for group reads
            if (job.data.type === 'group_read') {
                try {
                    await WarmupGroupReaderService_1.WarmupGroupReaderService.readGroupMessage(client, job.data.messageKey);
                    warmupLogger_1.warmupLogger.info(`[WarmupQueue] Successfully processed group read job ${job.id} for instance ${instanceId}`);
                    return;
                }
                catch (error) {
                    warmupLogger_1.warmupLogger.error(`[WarmupQueue] Failed to process group read job ${job.id}`, error);
                    throw error;
                }
            }
            // Specific handling for checking sent messages
            if (job.data.type === 'check_sent') {
                try {
                    await WarmupBaileysService_1.WarmupBaileysService.simulateCheckingSentMessage(client, job.data.targetJid);
                    warmupLogger_1.warmupLogger.info(`[WarmupQueue] Successfully processed check_sent job ${job.id} for instance ${instanceId}`);
                    return;
                }
                catch (error) {
                    warmupLogger_1.warmupLogger.error(`[WarmupQueue] Failed to process check_sent job ${job.id}`, error);
                    throw error;
                }
            }
            // Specific handling for individual reads (Blue Ticks)
            if (job.data.type === 'individual_read') {
                try {
                    await WarmupBaileysService_1.WarmupBaileysService.simulateHumanRead(client, job.data.messageKey.remoteJid, job.data.messageKey);
                    warmupLogger_1.warmupLogger.info(`[WarmupQueue] Successfully processed individual read job ${job.id} for instance ${instanceId}`);
                    return;
                }
                catch (error) {
                    warmupLogger_1.warmupLogger.error(`[WarmupQueue] Failed to process individual read job ${job.id}`, error);
                    throw error;
                }
            }
            // Specific handling for event reply triggers
            if (job.data.type === 'event_reply') {
                try {
                    // Utilizamos o sendWarmupMessage que já simula digitação natural
                    const sentKey = await WarmupBaileysService_1.WarmupBaileysService.sendWarmupMessage(client, job.data.targetJid, job.data.content);
                    await WarmupCacheService_1.WarmupCacheService.incrementMessagesSent(instanceId);
                    if (job.data.shouldDelete && sentKey) {
                        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Simulating regret! Deleting event reply for ${job.data.targetJid}...`);
                        await delay(Math.floor(Math.random() * 3000) + 2000); // Wait 2-5s
                        await WarmupBaileysService_1.WarmupBaileysService.deleteWarmupMessage(client, job.data.targetJid, sentKey);
                        WarmupAuditService_1.WarmupAuditService.logInteraction({
                            instanceId,
                            contactJid: job.data.targetJid,
                            direction: 'SENT',
                            content: job.data.content,
                            isAiGenerated: true,
                            metadata: { deleted: true }
                        });
                        return;
                    }
                    WarmupAuditService_1.WarmupAuditService.logInteraction({
                        instanceId,
                        contactJid: job.data.targetJid,
                        direction: 'SENT',
                        content: job.data.content,
                        isAiGenerated: true,
                        metadata: { type: 'event_reply' }
                    });
                    // Agendar verificação da mensagem enviada (50% de chance)
                    if (Math.random() > 0.5) {
                        const checkDelay = Math.floor(Math.random() * 270000) + 30000; // 30s to 5m
                        await WarmupQueue.addCheckSentJob({ instanceId, targetJid: job.data.targetJid }, checkDelay);
                    }
                    if (job.data.correction) {
                        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Sending typo correction for event reply...`);
                        await delay(Math.floor(Math.random() * 2000) + 1000);
                        await WarmupBaileysService_1.WarmupBaileysService.sendWarmupMessage(client, job.data.targetJid, job.data.correction);
                        WarmupAuditService_1.WarmupAuditService.logInteraction({
                            instanceId,
                            contactJid: job.data.targetJid,
                            direction: 'SENT',
                            content: job.data.correction,
                            isAiGenerated: false,
                            metadata: { isCorrection: true }
                        });
                    }
                    warmupLogger_1.warmupLogger.info(`[WarmupQueue] Successfully processed event reply job ${job.id} for instance ${instanceId}`);
                    return;
                }
                catch (error) {
                    warmupLogger_1.warmupLogger.error(`[WarmupQueue] Failed to process event reply job ${job.id}`, error);
                    throw error;
                }
            }
            // Specific handling for status post
            if (job.data.type === 'status_post') {
                try {
                    await WarmupStatusPublisherService_1.WarmupStatusPublisherService.executeStatusPost(client, instanceId);
                    warmupLogger_1.warmupLogger.info(`[WarmupQueue] Successfully processed status post job ${job.id} for instance ${instanceId}`);
                    return;
                }
                catch (error) {
                    warmupLogger_1.warmupLogger.error(`[WarmupQueue] Failed to process status post job ${job.id}`, error);
                    throw error;
                }
            }
            // Check Rate Limits for actual messages (generic messages, seed messages, and event replies)
            const jobData = job.data;
            if (jobData.type === 'message' || jobData.type === 'seed_message' || jobData.type === 'event_reply') {
                const canSend = await WarmupRateLimiterService_1.WarmupRateLimiterService.canSendToday(instanceId, profile.currentPhase, profile.dailyLimit);
                if (!canSend) {
                    warmupLogger_1.warmupLogger.warn(`[WarmupQueue] Rate limit exceeded for instance ${instanceId}. Discarding job ${job.id}.`);
                    // Returning early counts the job as 'completed' (successfully discarded) so it doesn't retry
                    return;
                }
                // Verificação de Assimetria: Se o bot estiver mandando mensagens demais sem receber resposta
                const isSymmetric = await WarmupAsymmetryService_1.WarmupAsymmetryService.evaluateAndBlockIfNeeded(instanceId);
                if (!isSymmetric) {
                    warmupLogger_1.warmupLogger.warn(`[WarmupQueue] ASYMMETRY BLOCK ACTIVE for instance ${instanceId}. Dropping/delaying job ${job.id}.`);
                    throw new Error('Asymmetry block active');
                }
            }
            // Specific handling for seed messages
            if (job.data.type === 'seed_message') {
                try {
                    await WarmupSeedMessagingService_1.WarmupSeedMessagingService.executeSeedMessage(client, instanceId, job.data.seedPhone);
                    await WarmupCacheService_1.WarmupCacheService.incrementMessagesSent(instanceId);
                    // Agendar verificação da mensagem enviada (50% de chance)
                    if (Math.random() > 0.5) {
                        const targetJid = `${job.data.seedPhone}@c.us`; // Use @c.us for whatsapp-web.js
                        const checkDelay = Math.floor(Math.random() * 270000) + 30000;
                        await WarmupQueue.addCheckSentJob({ instanceId, targetJid }, checkDelay);
                    }
                    warmupLogger_1.warmupLogger.info(`[WarmupQueue] Successfully processed seed message job ${job.id} for instance ${instanceId}`);
                    return;
                }
                catch (error) {
                    warmupLogger_1.warmupLogger.error(`[WarmupQueue] Failed to process seed message job ${job.id}`, error);
                    throw error;
                }
            }
            if (job.data.type === 'message') {
                try {
                    const { targetJid, messageType, content } = job.data;
                    if (messageType === 'text') {
                        await WarmupBaileysService_1.WarmupBaileysService.sendWarmupMessage(client, targetJid, content);
                        WarmupAuditService_1.WarmupAuditService.logInteraction({
                            instanceId,
                            contactJid: targetJid,
                            direction: 'SENT',
                            content: content,
                            isAiGenerated: false,
                            metadata: { type: 'standard_message' }
                        });
                        // Agendar verificação da mensagem enviada (50% de chance)
                        if (Math.random() > 0.5) {
                            const checkDelay = Math.floor(Math.random() * 270000) + 30000;
                            await WarmupQueue.addCheckSentJob({ instanceId, targetJid }, checkDelay);
                        }
                    }
                    else if (messageType === 'image') {
                        // Future-proofing for media sends if needed
                        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Image sending not fully implemented yet for Warmup. Skipping.`);
                    }
                    // Clear any previous failures and increment success counter
                    await WarmupBackoffService_1.WarmupBackoffService.registerSuccess(instanceId);
                    await WarmupCacheService_1.WarmupCacheService.incrementMessagesSent(instanceId);
                    warmupLogger_1.warmupLogger.info(`[WarmupQueue] Job ${job.id} completed successfully for instance ${instanceId}.`);
                }
                catch (error) {
                    warmupLogger_1.warmupLogger.error(`[WarmupQueue] Job ${job.id} failed for instance ${instanceId}:`, error);
                    // Se for HardBounceError ou 404 do Baileys, o problema é o destinatário (não penalizar nosso chip)
                    if (error instanceof WarmupBounceService_1.HardBounceError || (error?.data === 404)) {
                        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Job ${job.id} failed due to invalid recipient. Not applying penalty to instance ${instanceId}.`);
                        return; // Ignora o erro para que não acione o Backoff, afinal a limpeza do banco já foi feita
                    }
                    // Any other error registers a failure (e.g. 429, timeouts, disconnects)
                    await WarmupBackoffService_1.WarmupBackoffService.registerFailure(instanceId);
                    // Verificação de Fallback 429
                    if (error?.output?.statusCode === 429 || error?.message?.includes('429')) {
                        warmupLogger_1.warmupLogger.error(`[WarmupQueue] 429 Too Many Requests detected for instance ${instanceId}. Triggering EMERGENCY FALLBACK.`);
                        // Não dar await para não bloquear o retry imediato se necessário, ou dar await para garantir a segurança.
                        // O Fallback vai pegar os jobs futuros na fila.
                        WarmupFallbackService_1.WarmupFallbackService.triggerFallback(instanceId).catch(err => {
                            warmupLogger_1.warmupLogger.error(`[WarmupQueue] Fallback failed for instance ${instanceId}`, err);
                        });
                    }
                    throw error; // Let BullMQ handle the retry backoff
                }
            }
        }, {
            connection: redisConnection,
            concurrency: 1, // Crucial for Anti-Spam (serial processing)
            limiter: {
                max: 10,
                duration: 60000, // Max 10 messages per minute globally across the queue
            }
        });
        this.worker.on('failed', (job, err) => {
            warmupLogger_1.warmupLogger.warn(`[WarmupQueue] Job ${job?.id} failed with error: ${err.message}`);
        });
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Worker initialized and listening on ${QUEUE_NAME}`);
    }
    /**
     * Enqueues a new warmup message job.
     */
    static async addMessageJob(data, delayMs = 0) {
        const jobData = { ...data, type: 'message' };
        const job = await this.queue.add('send-message', jobData, { delay: delayMs });
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Message Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
        return job;
    }
    /**
     * Enqueues a status view job.
     */
    static async addStatusJob(data, delayMs = 0) {
        const jobData = { ...data, type: 'status_view' };
        const job = await this.queue.add('view-status', jobData, { delay: delayMs });
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Status View Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
        return job;
    }
    /**
     * Enqueues a group read job.
     */
    static async addGroupReadJob(data, delayMs = 0) {
        const jobData = { ...data, type: 'group_read' };
        const job = await this.queue.add('read-group', jobData, { delay: delayMs });
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Group Read Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
        return job;
    }
    /**
     * Enqueues an individual read job.
     */
    static async addIndividualReadJob(data, delayMs = 0) {
        const jobData = { ...data, type: 'individual_read' };
        const job = await this.queue.add('read-individual', jobData, { delay: delayMs });
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Individual Read Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
        return job;
    }
    /**
     * Enqueues an event reply job (e.g. sending a thumbs up to a seed).
     */
    static async addEventReplyJob(data, delayMs = 0) {
        const jobData = { ...data, type: 'event_reply' };
        const job = await this.queue.add('event-reply', jobData, { delay: delayMs });
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Event Reply Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
        return job;
    }
    /**
     * Enqueues a check sent message job.
     */
    static async addCheckSentJob(data, delayMs = 0) {
        const jobData = { ...data, type: 'check_sent' };
        const job = await this.queue.add('check-sent', jobData, { delay: delayMs });
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Check Sent Job ${job.id} added for instance ${data.instanceId} to ${data.targetJid} with delay ${delayMs}ms`);
        return job;
    }
    /**
     * Enqueues a status post job.
     */
    static async addStatusPostJob(data, delayMs = 0) {
        const jobData = { ...data, type: 'status_post' };
        const job = await this.queue.add('post-status', jobData, { delay: delayMs });
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Status Post Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
        return job;
    }
    /**
     * Enqueues a seed message job.
     */
    static async addSeedMessageJob(data, delayMs = 0) {
        const jobData = { ...data, type: 'seed_message' };
        const job = await this.queue.add('seed-message', jobData, { delay: delayMs });
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] Seed Message Job ${job.id} added for instance ${data.instanceId} to ${data.seedPhone} with delay ${delayMs}ms`);
        return job;
    }
    /**
     * Pauses the entire BullMQ queue (useful for off-hours / sleep cycles).
     */
    static async pauseQueue() {
        await this.queue.pause();
        warmupLogger_1.warmupLogger.warn(`[WarmupQueue] GLOBAL PAUSE activated. No warmup messages will be processed.`);
    }
    /**
     * Resumes the entire BullMQ queue.
     */
    static async resumeQueue() {
        await this.queue.resume();
        warmupLogger_1.warmupLogger.info(`[WarmupQueue] GLOBAL RESUME activated. Processing restored.`);
    }
    /**
     * Identifica todos os jobs de uma instância e os move para outra.
     */
    static async transferJobs(fromInstanceId, toInstanceId) {
        const statuses = ['waiting', 'delayed'];
        const jobs = await this.queue.getJobs(statuses);
        let transferred = 0;
        for (const job of jobs) {
            if (job && job.data && job.data.instanceId === fromInstanceId) {
                const newData = { ...job.data, instanceId: toInstanceId };
                // Mantém o atraso original se for um job delayed
                let delay = 0;
                if (await job.isDelayed()) {
                    delay = Math.max(0, job.timestamp + job.delay - Date.now());
                }
                // Remove the original job
                await job.remove();
                // Adiciona de volta com o novo ID
                await this.queue.add(job.name, newData, { delay });
                transferred++;
            }
        }
        return transferred;
    }
}
exports.WarmupQueue = WarmupQueue;
