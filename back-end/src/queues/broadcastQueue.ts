import { Queue, Worker, Job } from 'bullmq';
import logger from '../utils/logger';
import redisClient from '../utils/redisClient';
import draftService from '../services/DraftService';
import whatsAppInstanceManager from '../services/WhatsAppInstanceManager';
import feedHistoryService from '../services/FeedHistoryService';
import contactService from '../services/ContactService';
import { Contact } from '@prisma/client';
import { WarmupBroadcastIntegrationService } from '../Warm-up/services/WarmupBroadcastIntegrationService';

export const BROADCAST_QUEUE_NAME = 'broadcast-processing-queue';

export const broadcastQueue = new Queue(BROADCAST_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000, // 1 minute base delay
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export interface BroadcastJobData {
  draftId: number;
  userId: number;
  imagePath?: string | null;
  contacts: Pick<Contact, 'id' | 'phoneNumber' | 'name'>[];
  delayMs?: number;
}

export const broadcastProcessor = async (job: Job<BroadcastJobData>) => {
    const { draftId, userId, contacts } = job.data;
    logger.info(`[broadcast-worker]: Started broadcasting Draft ${draftId} to ${contacts.length} contacts.`);

    try {
      // 1. Fetch Draft Details
      const draft = await draftService.getDraftById(draftId, userId);
      if (!draft || draft.status !== 'APPROVED') {
        throw new Error(`Draft ${draftId} not found or not approved.`);
      }

      // 2. Format Message (Assuming the Draft has titulo, resumo, fonte in generatedContent)
      const content = draft.generatedContent as any;
      let bodyText = content.resumo || '';
      if (content.corpo && content.corpo.trim() !== '') {
        bodyText += '\n\n' + content.corpo.trim();
      }
      const messageText = `*${content.titulo || 'Notícia'}*\n\n${bodyText}\n\n_Fonte: ${content.fonte || 'Desconhecida'}_`;

      // 3. Retrieve User's Connected WhatsApp Instances (Filtered by Warm-up Status)
      const userInstances = await WarmupBroadcastIntegrationService.getEligibleInstancesForBroadcast(userId);
      
      if (userInstances.length === 0) {
        throw new Error(`No connected WhatsApp instances found for user ${userId}. Cannot broadcast.`);
      }

      logger.info(`[broadcast-worker]: Found ${userInstances.length} connected instances for user ${userId}. Using Round-Robin routing.`);

      // 4. Send Messages Sequentially with Round-Robin
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < contacts.length; i++) {
        // Intercept: check if the user cancelled the broadcast while this job was active
        const currentDraftState = await draftService.getDraftById(draftId, userId);
        if (currentDraftState && currentDraftState.status === 'CANCELLED') {
          logger.warn(`[broadcast-worker]: Draft ${draftId} was cancelled mid-flight. Halting broadcast.`);
          break; // Stop iterating
        }

        const contact = contacts[i];

        // 1. Create 'pending' log
        const logRecord = await feedHistoryService.logMessage({
          draftId,
          userId,
          contactNumber: contact.phoneNumber,
          messageContent: messageText,
          status: 'pending'
        });

        try {
          // 2. Select Instance via Round-Robin
          const instanceToUse = userInstances[i % userInstances.length];
          const instanceId = instanceToUse.getInstanceId();
          
          logger.info(`[broadcast-worker]: Routing message to contact ${contact.phoneNumber} via instance ${instanceId}`);
          
          // 3. Use the provided delayMs or fallback to a default 3.5s delay
          const delayMs = job.data.delayMs || 3500;
          const messageId = await instanceToUse.sendMessage(contact.phoneNumber, messageText, delayMs, job.data.imagePath || undefined);
          
          // 4. Mark as sent and associate messageId
          await feedHistoryService.updateMessageStatus(String(logRecord._id), 'sent', undefined, messageId);
          successCount++;
        } catch (error) {
          const err = error as any;
          logger.error(`[broadcast-worker]: Failed to send to ${contact.phoneNumber}: ${err.message}`);

          // Detect invalid number / not registered on WhatsApp
          const isInvalidNumber = 
            err.statusCode === 404 || 
            err.message?.toLowerCase().includes('not registered') ||
            err.message?.toLowerCase().includes('invalid') ||
            err.message?.toLowerCase().includes('not exist');

          if (isInvalidNumber) {
            logger.warn(`[broadcast-worker]: Contact ${contact.phoneNumber} is invalid on WhatsApp. Deactivating in DB.`);
            try {
              await contactService.update(contact.id, userId, { active: false });
            } catch (dbErr) {
              logger.error(`[broadcast-worker]: Failed to deactivate contact ${contact.id}: ${(dbErr as Error).message}`);
            }
            await feedHistoryService.updateMessageStatus(String(logRecord._id), 'failed', 'invalid_number');
          } else {
            // 3. Mark as failed normally
            await feedHistoryService.updateMessageStatus(String(logRecord._id), 'failed', err.message);
          }
          
          failCount++;

          // Dynamic Pause: if rate limited, wait 60s
          const isRateLimited = 
            err.statusCode === 429 || 
            err.message?.toLowerCase().includes('rate') ||
            err.message?.toLowerCase().includes('block');

          // Timeout / Connection Error -> Trigger Job Retry
          const isTimeoutOrNetworkError = 
            err.statusCode === 503 || 
            err.statusCode === 504 ||
            err.message?.toLowerCase().includes('timeout') ||
            err.message?.toLowerCase().includes('connection closed') ||
            err.message?.toLowerCase().includes('disconnect');

          if (isRateLimited) {
            logger.warn(`[broadcast-worker]: Temporary block detected. Pausing worker for 60 seconds...`);
            await new Promise(res => setTimeout(res, 60000));
          } else if (isTimeoutOrNetworkError) {
            logger.error(`[broadcast-worker]: Network timeout. Re-queuing remaining ${contacts.length - i} contacts.`);
            // Update job data to only include remaining contacts
            await job.updateData({
              ...job.data,
              contacts: contacts.slice(i)
            });
            // Throwing triggers BullMQ's exponential backoff and retry (max 3 attempts)
            throw err;
          } else {
            // Not a timeout, just a regular error (like rate limit that was paused, or something else)
            logger.error(`[broadcast-worker]: Unhandled error for contact ${contact.phoneNumber}: ${err.message}. Skipping to next contact.`);
          }
        }

        // Update Job Progress
        const progress = Math.round(((i + 1) / contacts.length) * 100);
        await job.updateProgress(progress);
      }

      logger.info(`[broadcast-worker]: Completed Draft ${draftId}. Success: ${successCount}, Failed: ${failCount}.`);
      return { successCount, failCount };
    } catch (error) {
      logger.error(`[broadcast-worker]: Job ${job.id} failed: ${(error as Error).message}`);
      throw error;
    }
  };

export const broadcastWorker = new Worker<BroadcastJobData>(
  BROADCAST_QUEUE_NAME,
  broadcastProcessor,
  {
    connection: redisClient,
    concurrency: 1, // Strict concurrency = 1 to respect WhatsApp rate limits globally
  }
);

broadcastWorker.on('failed', (job, err) => {
  logger.error(`[broadcast-worker]: Job ${job?.id} permanently failed: ${err.message}`);
});
