import { Queue, Worker, Job } from 'bullmq';
import logger from '../utils/logger';
import redisClient from '../utils/redisClient';
import draftService from '../services/DraftService';
import whatsAppInstanceManager from '../services/WhatsAppInstanceManager';
import feedHistoryService from '../services/FeedHistoryService';
import contactService from '../services/ContactService';
import campaignService from '../services/CampaignService';
import { CampaignStatus } from '@prisma/client';
import { Contact } from '@prisma/client';
import prisma from '../models/prismaClient';

export const BROADCAST_QUEUE_NAME = 'broadcast-processing-queue';

export const broadcastQueue = new Queue(BROADCAST_QUEUE_NAME, {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60000,
    },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
});

export interface BroadcastJobData {
  draftId: number;
  userId: number;
  imagePath?: string | null;
  delayMs?: number;
  /** New path: one contact per job (jobId = campaignId:contactId). */
  campaignId?: string;
  contact?: Pick<Contact, 'id' | 'phoneNumber' | 'name'>;
  /** Legacy path: full contact list in one job. */
  contacts?: Pick<Contact, 'id' | 'phoneNumber' | 'name'>[];
}

async function sendToContact(params: {
  draftId: number;
  userId: number;
  contact: Pick<Contact, 'id' | 'phoneNumber' | 'name'>;
  messageText: string;
  delayMs: number;
  imagePath?: string | null;
  instanceIndex: number;
}): Promise<'SENT' | 'FAILED'> {
  const { draftId, userId, contact, messageText, delayMs, imagePath, instanceIndex } = params;

  const userInstances = whatsAppInstanceManager.getInstancesForUser(userId).filter(
    (inst) => inst.getStatus().state === 'open',
  );
  if (userInstances.length === 0) {
    throw Object.assign(new Error('CHANNEL_DISCONNECTED'), { statusCode: 409 });
  }

  const logRecord = await feedHistoryService.logMessage({
    draftId,
    userId,
    contactNumber: contact.phoneNumber,
    messageContent: messageText,
    status: 'pending',
  });

  try {
    const instanceToUse = userInstances[instanceIndex % userInstances.length];
    const messageId = await instanceToUse.sendMessage(
      contact.phoneNumber,
      messageText,
      delayMs,
      imagePath || undefined,
    );
    await feedHistoryService.updateMessageStatus(String(logRecord._id), 'sent', undefined, messageId);
    return 'SENT';
  } catch (error) {
    const err = error as { statusCode?: number; message?: string };
    const isInvalidNumber =
      err.statusCode === 404 ||
      err.message?.toLowerCase().includes('not registered') ||
      err.message?.toLowerCase().includes('invalid') ||
      err.message?.toLowerCase().includes('not exist');

    if (isInvalidNumber) {
      try {
        await contactService.update(contact.id, userId, { active: false });
      } catch (dbErr) {
        logger.error(`[broadcast-worker]: Failed to deactivate contact ${contact.id}: ${(dbErr as Error).message}`);
      }
      await feedHistoryService.updateMessageStatus(String(logRecord._id), 'failed', 'invalid_number');
    } else {
      await feedHistoryService.updateMessageStatus(String(logRecord._id), 'failed', err.message);
    }
    return 'FAILED';
  }
}

function buildMessageText(draft: { generatedContent: unknown }): string {
  const content = draft.generatedContent as { titulo?: string; resumo?: string; corpo?: string; fonte?: string };
  let bodyText = content.resumo || '';
  if (content.corpo && content.corpo.trim() !== '') {
    bodyText += '\n\n' + content.corpo.trim();
  }
  return `*${content.titulo || 'Notícia'}*\n\n${bodyText}\n\n_Fonte: ${content.fonte || 'Desconhecida'}_`;
}

export const broadcastProcessor = async (job: Job<BroadcastJobData>) => {
  const { draftId, userId, campaignId, contact, contacts } = job.data;
  const delayMs = job.data.delayMs || 3500;

  // ── New path: single-contact campaign job ──────────────────────────────
  if (campaignId && contact) {
    logger.info(`[broadcast-worker]: campaign=${campaignId} contact=${contact.id}`);

    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
    if (campaign.status === CampaignStatus.CANCELLED) {
      await campaignService.markRecipientResult(campaignId, contact.id, 'SKIPPED', 'campaign_cancelled');
      return { skipped: true };
    }
    if (campaign.status === CampaignStatus.PAUSED) {
      // Re-delay job while paused
      throw Object.assign(new Error('CAMPAIGN_PAUSED'), { statusCode: 503 });
    }

    await campaignService.markRecipientActive(campaignId, contact.id);

    const draft = await draftService.getDraftById(draftId, userId);
    if (!draft || (draft.status !== 'APPROVED' && draft.status !== 'CANCELLED')) {
      await campaignService.markRecipientResult(campaignId, contact.id, 'FAILED', 'draft_unavailable');
      throw new Error(`Draft ${draftId} not found or not approved.`);
    }
    if (draft.status === 'CANCELLED') {
      await campaignService.markRecipientResult(campaignId, contact.id, 'SKIPPED', 'draft_cancelled');
      return { skipped: true };
    }

    const messageText = buildMessageText(draft);
    try {
      const result = await sendToContact({
        draftId,
        userId,
        contact,
        messageText,
        delayMs,
        imagePath: job.data.imagePath,
        instanceIndex: contact.id,
      });
      await campaignService.markRecipientResult(
        campaignId,
        contact.id,
        result === 'SENT' ? 'SENT' : 'FAILED',
        result === 'FAILED' ? 'send_failed' : undefined,
      );
      return { result };
    } catch (error) {
      const err = error as { statusCode?: number; message?: string };
      if (err.statusCode === 503 || err.message === 'CAMPAIGN_PAUSED') throw error;
      await campaignService.markRecipientResult(campaignId, contact.id, 'FAILED', err.message);
      throw error;
    }
  }

  // ── Legacy path: multi-contact job ─────────────────────────────────────
  const list = contacts || [];
  logger.info(`[broadcast-worker]: Started broadcasting Draft ${draftId} to ${list.length} contacts.`);

  try {
    const draft = await draftService.getDraftById(draftId, userId);
    if (!draft || draft.status !== 'APPROVED') {
      throw new Error(`Draft ${draftId} not found or not approved.`);
    }

    const messageText = buildMessageText(draft);
    const userInstances = whatsAppInstanceManager.getInstancesForUser(userId).filter(
      (inst) => inst.getStatus().state === 'open',
    );
    if (userInstances.length === 0) {
      throw new Error(`No connected WhatsApp instances found for user ${userId}. Cannot broadcast.`);
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < list.length; i++) {
      const currentDraftState = await draftService.getDraftById(draftId, userId);
      if (currentDraftState && currentDraftState.status === 'CANCELLED') {
        logger.warn(`[broadcast-worker]: Draft ${draftId} was cancelled mid-flight. Halting broadcast.`);
        break;
      }

      const c = list[i];
      const result = await sendToContact({
        draftId,
        userId,
        contact: c,
        messageText,
        delayMs,
        imagePath: job.data.imagePath,
        instanceIndex: i,
      });
      if (result === 'SENT') successCount += 1;
      else failCount += 1;
      await job.updateProgress(Math.round(((i + 1) / list.length) * 100));
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
    concurrency: 1,
  },
);

broadcastWorker.on('failed', (job, err) => {
  logger.error(`[broadcast-worker]: Job ${job?.id} permanently failed: ${err.message}`);
});
