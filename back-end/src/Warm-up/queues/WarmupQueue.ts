import { Queue, Worker, Job } from 'bullmq';
import { delay } from '@whiskeysockets/baileys';
import { warmupLogger } from '../utils/warmupLogger';
import { WarmupBaileysService } from '../services/WarmupBaileysService';
import { WarmupCacheService } from '../services/WarmupCacheService';
import { WarmupAuditService } from '../services/WarmupAuditService';
import { WarmupBackoffService } from '../services/WarmupBackoffService';
import { WarmupBounceService, HardBounceError } from '../services/WarmupBounceService';
import { WarmupRateLimiterService } from '../services/WarmupRateLimiterService';
import { WarmupStatusViewerService } from '../services/WarmupStatusViewerService';
import { WarmupGroupReaderService } from '../services/WarmupGroupReaderService';
import { WarmupStatusPublisherService } from '../services/WarmupStatusPublisherService';
import { WarmupSeedMessagingService } from '../services/WarmupSeedMessagingService';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupAsymmetryService } from '../services/WarmupAsymmetryService';
import { WarmupFallbackService } from '../services/WarmupFallbackService';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import { proto } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import IORedis from 'ioredis';

// Shared redis connection for BullMQ
const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

export interface WarmupMessageJob {
  type: 'message';
  instanceId: string;
  targetJid: string;
  messageType: 'text' | 'image' | 'audio';
  content: string | Buffer; // text content or media buffer
  caption?: string; // Optional for media
}

export interface WarmupStatusJob {
  type: 'status_view';
  instanceId: string;
  messageKey: proto.IMessageKey;
}

export interface WarmupGroupReadJob {
  type: 'group_read';
  instanceId: string;
  messageKey: proto.IMessageKey;
}

export interface WarmupStatusPostJob {
  type: 'status_post';
  instanceId: string;
}

export interface WarmupSeedMessageJob {
  type: 'seed_message';
  instanceId: string;
  seedPhone: string;
}

export interface WarmupIndividualReadJob {
  type: 'individual_read';
  instanceId: string;
  messageKey: proto.IMessageKey;
}

export interface WarmupEventReplyJob {
  type: 'event_reply';
  instanceId: string;
  targetJid: string;
  content: string;
  correction?: string;
  shouldDelete?: boolean;
}

export type WarmupJobData = WarmupMessageJob | WarmupStatusJob | WarmupGroupReadJob | WarmupStatusPostJob | WarmupSeedMessageJob | WarmupIndividualReadJob | WarmupEventReplyJob;

const QUEUE_NAME = 'warmup-message-queue';

export class WarmupQueue {
  private static queue = new Queue<WarmupJobData>(QUEUE_NAME, {
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

  private static worker: Worker<WarmupJobData>;

  /**
   * Initializes the Worker to process warmup jobs.
   * Concurrency is 1 to naturally funnel the requests and respect WhatsApp pacing per instance.
   */
  static initWorker() {
    if (this.worker) return;

    this.worker = new Worker<WarmupJobData>(
      QUEUE_NAME,
      async (job: Job<WarmupJobData>) => {
        const { instanceId } = job.data;
        warmupLogger.info(`[WarmupQueue] Processing job ${job.id} for instance ${instanceId}`);

        const whatsappInstance = whatsAppInstanceManager.getInstance(parseInt(instanceId, 10));
        const socket = whatsappInstance?.getSocket();

        if (!whatsappInstance || !socket) {
          throw new Boom(`WhatsApp socket not connected for instance ${instanceId}`, { statusCode: 400 });
        }

        // Check Rate Limits (Safety Net)
        const profile = await WarmupProfileService.getProfile(instanceId);
        if (!profile) {
          throw new Boom(`Warmup profile not found for instance ${instanceId}`, { statusCode: 404 });
        }

        // Specific handling for status viewing
        if (job.data.type === 'status_view') {
          try {
            await WarmupStatusViewerService.viewStatus(socket, job.data.messageKey);
            warmupLogger.info(`[WarmupQueue] Successfully processed status view job ${job.id} for instance ${instanceId}`);
            return;
          } catch (error) {
            warmupLogger.error(`[WarmupQueue] Failed to process status view job ${job.id}`, error);
            throw error;
          }
        }

        // Specific handling for group reads
        if (job.data.type === 'group_read') {
          try {
            await WarmupGroupReaderService.readGroupMessage(socket, job.data.messageKey);
            warmupLogger.info(`[WarmupQueue] Successfully processed group read job ${job.id} for instance ${instanceId}`);
            return;
          } catch (error) {
            warmupLogger.error(`[WarmupQueue] Failed to process group read job ${job.id}`, error);
            throw error;
          }
        }

        // Specific handling for individual reads (Blue Ticks)
        if (job.data.type === 'individual_read') {
          try {
            await WarmupBaileysService.simulateHumanRead(socket, job.data.messageKey.remoteJid!, job.data.messageKey);
            warmupLogger.info(`[WarmupQueue] Successfully processed individual read job ${job.id} for instance ${instanceId}`);
            return;
          } catch (error) {
            warmupLogger.error(`[WarmupQueue] Failed to process individual read job ${job.id}`, error);
            throw error;
          }
        }

        // Specific handling for event reply triggers
        if (job.data.type === 'event_reply') {
          try {
            // Utilizamos o sendWarmupMessage que já simula digitação natural
            const sentKey = await WarmupBaileysService.sendWarmupMessage(socket, job.data.targetJid, job.data.content);
            await WarmupCacheService.incrementMessagesSent(instanceId);

            if (job.data.shouldDelete && sentKey) {
              warmupLogger.info(`[WarmupQueue] Simulating regret! Deleting event reply for ${job.data.targetJid}...`);
              await delay(Math.floor(Math.random() * 3000) + 2000); // Wait 2-5s
              await WarmupBaileysService.deleteWarmupMessage(socket, job.data.targetJid, sentKey);
              
              WarmupAuditService.logInteraction({
                instanceId,
                contactJid: job.data.targetJid,
                direction: 'SENT',
                content: job.data.content,
                isAiGenerated: true,
                metadata: { deleted: true }
              });
              
              return;
            }
            
            WarmupAuditService.logInteraction({
              instanceId,
              contactJid: job.data.targetJid,
              direction: 'SENT',
              content: job.data.content,
              isAiGenerated: true,
              metadata: { type: 'event_reply' }
            });

            if (job.data.correction) {
              warmupLogger.info(`[WarmupQueue] Sending typo correction for event reply...`);
              await delay(Math.floor(Math.random() * 2000) + 1000);
              await WarmupBaileysService.sendWarmupMessage(socket, job.data.targetJid, job.data.correction);
              
              WarmupAuditService.logInteraction({
                instanceId,
                contactJid: job.data.targetJid,
                direction: 'SENT',
                content: job.data.correction,
                isAiGenerated: false,
                metadata: { isCorrection: true }
              });
            }

            warmupLogger.info(`[WarmupQueue] Successfully processed event reply job ${job.id} for instance ${instanceId}`);
            return;
          } catch (error) {
            warmupLogger.error(`[WarmupQueue] Failed to process event reply job ${job.id}`, error);
            throw error;
          }
        }

        // Specific handling for status post
        if (job.data.type === 'status_post') {
          try {
            await WarmupStatusPublisherService.executeStatusPost(socket, instanceId);
            warmupLogger.info(`[WarmupQueue] Successfully processed status post job ${job.id} for instance ${instanceId}`);
            return;
          } catch (error) {
            warmupLogger.error(`[WarmupQueue] Failed to process status post job ${job.id}`, error);
            throw error;
          }
        }
        // Check Rate Limits for actual messages (generic messages, seed messages, and event replies)
        const jobData = job.data as any;
        if (jobData.type === 'message' || jobData.type === 'seed_message' || jobData.type === 'event_reply') {
          const canSend = await WarmupRateLimiterService.canSendToday(instanceId, profile.currentPhase, profile.dailyLimit);
          if (!canSend) {
            warmupLogger.warn(`[WarmupQueue] Rate limit exceeded for instance ${instanceId}. Discarding job ${job.id}.`);
            // Returning early counts the job as 'completed' (successfully discarded) so it doesn't retry
            return;
          }

          // Verificação de Assimetria: Se o bot estiver mandando mensagens demais sem receber resposta
          const isSymmetric = await WarmupAsymmetryService.evaluateAndBlockIfNeeded(instanceId);
          if (!isSymmetric) {
            warmupLogger.warn(`[WarmupQueue] ASYMMETRY BLOCK ACTIVE for instance ${instanceId}. Dropping/delaying job ${job.id}.`);
            throw new Error('Asymmetry block active');
          }
        }

        // Specific handling for seed messages
        if (job.data.type === 'seed_message') {
          try {
            await WarmupSeedMessagingService.executeSeedMessage(socket, instanceId, job.data.seedPhone);
            await WarmupCacheService.incrementMessagesSent(instanceId);
            warmupLogger.info(`[WarmupQueue] Successfully processed seed message job ${job.id} for instance ${instanceId}`);
            return;
          } catch (error) {
            warmupLogger.error(`[WarmupQueue] Failed to process seed message job ${job.id}`, error);
            throw error;
          }
        }

        if (job.data.type === 'message') {
          try {
            const { targetJid, messageType, content } = job.data;
            
            if (messageType === 'text') {
              await WarmupBaileysService.sendWarmupMessage(socket, targetJid, content as string);
              WarmupAuditService.logInteraction({
                instanceId,
                contactJid: targetJid,
                direction: 'SENT',
                content: content as string,
                isAiGenerated: false,
                metadata: { type: 'standard_message' }
              });
            } else if (messageType === 'image') {
              // Future-proofing for media sends if needed
              warmupLogger.info(`[WarmupQueue] Image sending not fully implemented yet for Warmup. Skipping.`);
            }
            
            // Clear any previous failures and increment success counter
            await WarmupBackoffService.registerSuccess(instanceId);
            await WarmupCacheService.incrementMessagesSent(instanceId);
            
            warmupLogger.info(`[WarmupQueue] Job ${job.id} completed successfully for instance ${instanceId}.`);
        } catch (error: any) {
          warmupLogger.error(`[WarmupQueue] Job ${job.id} failed for instance ${instanceId}:`, error);

          // Se for HardBounceError ou 404 do Baileys, o problema é o destinatário (não penalizar nosso chip)
          if (error instanceof HardBounceError || (error?.data === 404)) {
             warmupLogger.info(`[WarmupQueue] Job ${job.id} failed due to invalid recipient. Not applying penalty to instance ${instanceId}.`);
             return; // Ignora o erro para que não acione o Backoff, afinal a limpeza do banco já foi feita
          }

          // Any other error registers a failure (e.g. 429, timeouts, disconnects)
          await WarmupBackoffService.registerFailure(instanceId);
            
            // Verificação de Fallback 429
            if (error?.output?.statusCode === 429 || error?.message?.includes('429')) {
              warmupLogger.error(`[WarmupQueue] 429 Too Many Requests detected for instance ${instanceId}. Triggering EMERGENCY FALLBACK.`);
              // Não dar await para não bloquear o retry imediato se necessário, ou dar await para garantir a segurança.
              // O Fallback vai pegar os jobs futuros na fila.
              WarmupFallbackService.triggerFallback(instanceId).catch(err => {
                warmupLogger.error(`[WarmupQueue] Fallback failed for instance ${instanceId}`, err);
              });
            }

            throw error; // Let BullMQ handle the retry backoff
          }
        }
      },
      {
        connection: redisConnection,
        concurrency: 1, // Crucial for Anti-Spam (serial processing)
        limiter: {
          max: 10,
          duration: 60000, // Max 10 messages per minute globally across the queue
        }
      }
    );

    this.worker.on('failed', (job, err) => {
      warmupLogger.warn(`[WarmupQueue] Job ${job?.id} failed with error: ${err.message}`);
    });

    warmupLogger.info(`[WarmupQueue] Worker initialized and listening on ${QUEUE_NAME}`);
  }

  /**
   * Enqueues a new warmup message job.
   */
  static async addMessageJob(data: Omit<WarmupMessageJob, 'type'>, delayMs: number = 0): Promise<Job<WarmupJobData>> {
    const jobData: WarmupJobData = { ...data, type: 'message' };
    const job = await this.queue.add('send-message', jobData, { delay: delayMs });
    warmupLogger.info(`[WarmupQueue] Message Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
    return job;
  }

  /**
   * Enqueues a status view job.
   */
  static async addStatusJob(data: Omit<WarmupStatusJob, 'type'>, delayMs: number = 0): Promise<Job<WarmupJobData>> {
    const jobData: WarmupJobData = { ...data, type: 'status_view' };
    const job = await this.queue.add('view-status', jobData, { delay: delayMs });
    warmupLogger.info(`[WarmupQueue] Status View Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
    return job;
  }

  /**
   * Enqueues a group read job.
   */
  static async addGroupReadJob(data: Omit<WarmupGroupReadJob, 'type'>, delayMs: number = 0): Promise<Job<WarmupJobData>> {
    const jobData: WarmupJobData = { ...data, type: 'group_read' };
    const job = await this.queue.add('read-group', jobData, { delay: delayMs });
    warmupLogger.info(`[WarmupQueue] Group Read Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
    return job;
  }

  /**
   * Enqueues an individual read job.
   */
  static async addIndividualReadJob(data: Omit<WarmupIndividualReadJob, 'type'>, delayMs: number = 0): Promise<Job<WarmupJobData>> {
    const jobData: WarmupJobData = { ...data, type: 'individual_read' };
    const job = await this.queue.add('read-individual', jobData, { delay: delayMs });
    warmupLogger.info(`[WarmupQueue] Individual Read Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
    return job;
  }

  /**
   * Enqueues an event reply job (e.g. sending a thumbs up to a seed).
   */
  static async addEventReplyJob(data: Omit<WarmupEventReplyJob, 'type'>, delayMs: number = 0): Promise<Job<WarmupJobData>> {
    const jobData: WarmupJobData = { ...data, type: 'event_reply' };
    const job = await this.queue.add('event-reply', jobData, { delay: delayMs });
    warmupLogger.info(`[WarmupQueue] Event Reply Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
    return job;
  }

  /**
   * Enqueues a status post job.
   */
  static async addStatusPostJob(data: Omit<WarmupStatusPostJob, 'type'>, delayMs: number = 0): Promise<Job<WarmupJobData>> {
    const jobData: WarmupJobData = { ...data, type: 'status_post' };
    const job = await this.queue.add('post-status', jobData, { delay: delayMs });
    warmupLogger.info(`[WarmupQueue] Status Post Job ${job.id} added for instance ${data.instanceId} with delay ${delayMs}ms`);
    return job;
  }

  /**
   * Enqueues a seed message job.
   */
  static async addSeedMessageJob(data: Omit<WarmupSeedMessageJob, 'type'>, delayMs: number = 0): Promise<Job<WarmupJobData>> {
    const jobData: WarmupJobData = { ...data, type: 'seed_message' };
    const job = await this.queue.add('seed-message', jobData, { delay: delayMs });
    warmupLogger.info(`[WarmupQueue] Seed Message Job ${job.id} added for instance ${data.instanceId} to ${data.seedPhone} with delay ${delayMs}ms`);
    return job;
  }

  /**
   * Pauses the entire BullMQ queue (useful for off-hours / sleep cycles).
   */
  static async pauseQueue(): Promise<void> {
    await this.queue.pause();
    warmupLogger.warn(`[WarmupQueue] GLOBAL PAUSE activated. No warmup messages will be processed.`);
  }

  /**
   * Resumes the entire BullMQ queue.
   */
  static async resumeQueue(): Promise<void> {
    await this.queue.resume();
    warmupLogger.info(`[WarmupQueue] GLOBAL RESUME activated. Processing restored.`);
  }

  /**
   * Identifica todos os jobs de uma instância e os move para outra.
   */
  static async transferJobs(fromInstanceId: string, toInstanceId: string): Promise<number> {
    const statuses: any[] = ['waiting', 'delayed'];
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

