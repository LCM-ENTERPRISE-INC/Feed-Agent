import {
  Campaign,
  CampaignRecipient,
  CampaignRecipientStatus,
  CampaignStatus,
  Contact,
  DraftStatus,
  Prisma,
} from '@prisma/client';
import prisma from '../models/prismaClient';
import { AppError } from '../utils/AppError';
import { broadcastQueue, BROADCAST_QUEUE_NAME } from '../queues/broadcastQueue';
import whatsAppInstanceManager from './WhatsAppInstanceManager';
import feedHistoryService from './FeedHistoryService';
import campaignEventBus from './CampaignEventBus';
import logger from '../utils/logger';

export const DEFAULT_BROADCAST_BATCH_SIZE = Math.min(
  500,
  Math.max(1, parseInt(process.env.BROADCAST_BATCH_SIZE || '125', 10) || 125),
);

export type SelectionMode = 'all' | 'specific';

export interface AudiencePreviewInput {
  selectionMode: SelectionMode;
  contactIds?: number[];
  excludedIds?: number[];
  /** When true (default), exclude phones already sent/delivered/read for this draft. */
  skipAlreadySent?: boolean;
  draftId?: number;
}

export interface AudiencePreviewResult {
  totalContacts: number;
  activeContacts: number;
  inactiveContacts: number;
  eligibleContacts: number;
  invalidContacts: number;
  duplicateContacts: number;
  optOutContacts: number;
  excludedContacts: number;
  alreadySentContacts: number;
  batchSize: number;
  estimatedBatches: number;
}

export interface LaunchCampaignInput {
  selectionMode: SelectionMode;
  contactIds?: number[];
  excludedIds?: number[];
  delaySeconds: number;
  draftId?: number;
  title?: string;
  expectedRecipients?: number;
  skipAlreadySent?: boolean;
  batchSize?: number;
}

export interface LaunchCampaignResult {
  campaignId: string;
  batchId: string;
  expectedRecipients: number;
  materializedRecipients: number;
  queuedJobs: number;
  skippedAlreadySent: number;
  status: CampaignStatus;
  batchSize: number;
  estimatedBatches: number;
}

function isPhoneValid(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export class CampaignService {
  async previewAudience(userId: number, input: AudiencePreviewInput): Promise<AudiencePreviewResult> {
    const batchSize = DEFAULT_BROADCAST_BATCH_SIZE;
    const [totalContacts, activeContacts, inactiveContacts] = await Promise.all([
      prisma.contact.count({ where: { userId } }),
      prisma.contact.count({ where: { userId, active: true } }),
      prisma.contact.count({ where: { userId, active: false } }),
    ]);

    const candidates = await this.resolveEligibleContacts(userId, input, { includeInvalid: true });
    let invalidContacts = 0;
    let eligiblePool: Contact[] = [];
    for (const c of candidates) {
      if (!c.active) continue;
      if (!isPhoneValid(c.phoneNumber)) {
        invalidContacts += 1;
        continue;
      }
      eligiblePool.push(c);
    }

    const excludedSet = new Set((input.excludedIds || []).map(Number).filter(Number.isFinite));
    const afterExclude = eligiblePool.filter((c) => !excludedSet.has(c.id));
    const excludedContacts = eligiblePool.length - afterExclude.length;

    let alreadySentContacts = 0;
    let eligible = afterExclude;
    if (input.skipAlreadySent !== false && input.draftId) {
      const sentPhones = await feedHistoryService.getSentPhoneNumbersForDraft(userId, input.draftId);
      const before = eligible.length;
      eligible = eligible.filter((c) => !sentPhones.has(c.phoneNumber));
      alreadySentContacts = before - eligible.length;
    }

    const eligibleContacts = eligible.length;
    return {
      totalContacts,
      activeContacts,
      inactiveContacts,
      eligibleContacts,
      invalidContacts,
      duplicateContacts: 0,
      optOutContacts: 0,
      excludedContacts,
      alreadySentContacts,
      batchSize,
      estimatedBatches: eligibleContacts === 0 ? 0 : Math.ceil(eligibleContacts / batchSize),
    };
  }

  /**
   * Resolve contacts for selection without loading UI pages.
   * Cursor-friendly materialization happens in createAndEnqueue.
   */
  async resolveEligibleContacts(
    userId: number,
    input: AudiencePreviewInput,
    opts: { includeInvalid?: boolean } = {},
  ): Promise<Contact[]> {
    const where: Prisma.ContactWhereInput = { userId, active: true };

    if (input.selectionMode === 'specific') {
      const ids = (input.contactIds || []).map(Number).filter(Number.isFinite);
      if (ids.length === 0) return [];
      where.id = { in: ids };
    }

    const rows = await prisma.contact.findMany({
      where,
      orderBy: { id: 'asc' },
    });

    if (opts.includeInvalid) return rows;
    return rows.filter((c) => isPhoneValid(c.phoneNumber));
  }

  async createAndEnqueue(userId: number, input: LaunchCampaignInput): Promise<LaunchCampaignResult> {
    const selectionMode = input.selectionMode;
    if (selectionMode !== 'all' && selectionMode !== 'specific') {
      throw new AppError('selectionMode must be "all" or "specific".', 400);
    }
    if (typeof input.delaySeconds !== 'number' || input.delaySeconds < 1) {
      throw new AppError('A valid delaySeconds (>= 1) is required.', 400);
    }

    const connected = whatsAppInstanceManager
      .getInstancesForUser(userId)
      .filter((inst) => inst.getStatus().state === 'open');
    if (connected.length === 0) {
      throw new AppError('CHANNEL_DISCONNECTED: nenhum canal WhatsApp conectado.', 409);
    }

    let draftId = input.draftId;
    let title = input.title || 'Campanha';
    let imagePath: string | null = null;

    if (draftId) {
      const draft = await prisma.draft.findFirst({ where: { id: draftId, userId } });
      if (!draft) throw new AppError('Draft not found.', 404);
      if (draft.status !== DraftStatus.APPROVED) {
        await prisma.draft.update({ where: { id: draft.id }, data: { status: DraftStatus.APPROVED } });
      }
      const content = draft.generatedContent as { titulo?: string };
      title = input.title || content?.titulo || `Minuta #${draft.id}`;
      imagePath = draft.imagePath;
    } else {
      const approved = await prisma.draft.findMany({
        where: { userId, status: DraftStatus.APPROVED },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      });
      if (approved.length === 0) {
        throw new AppError('Nenhuma minuta aprovada encontrada para disparo.', 422);
      }
      draftId = approved[0].id;
      const content = approved[0].generatedContent as { titulo?: string };
      title = input.title || content?.titulo || `Minuta #${draftId}`;
      imagePath = approved[0].imagePath;
    }

    const skipAlreadySent = input.skipAlreadySent !== false;
    const batchSize = Math.min(
      500,
      Math.max(1, input.batchSize || DEFAULT_BROADCAST_BATCH_SIZE),
    );

    const preview = await this.previewAudience(userId, {
      selectionMode,
      contactIds: input.contactIds,
      excludedIds: input.excludedIds,
      skipAlreadySent,
      draftId,
    });

    if (preview.eligibleContacts === 0) {
      throw new AppError('Campanha vazia: nenhum contato elegível.', 422);
    }

    if (
      typeof input.expectedRecipients === 'number' &&
      input.expectedRecipients !== preview.eligibleContacts
    ) {
      throw new AppError(
        `Divergência de audiência: prévia=${input.expectedRecipients}, elegíveis=${preview.eligibleContacts}.`,
        409,
      );
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId,
        draftId,
        title,
        status: CampaignStatus.PREPARING,
        selectionMode,
        filtersJson: {},
        excludedIdsJson: input.excludedIds || [],
        contactIdsJson: selectionMode === 'specific' ? input.contactIds || [] : Prisma.JsonNull,
        expectedRecipients: preview.eligibleContacts,
        materializedRecipients: 0,
        queuedJobs: 0,
        pendingCount: 0,
        batchSize,
        delayMs: Math.round(input.delaySeconds * 1000),
        skipAlreadySent,
      },
    });

    campaignEventBus.emitCampaign({
      type: 'campaign.preparing',
      campaignId: campaign.id,
      userId,
      payload: { expectedRecipients: preview.eligibleContacts },
      at: new Date().toISOString(),
    });

    try {
      const contacts = await this.materializeAudience(userId, {
        selectionMode,
        contactIds: input.contactIds,
        excludedIds: input.excludedIds,
        skipAlreadySent,
        draftId,
      });

      if (contacts.length !== preview.eligibleContacts) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: CampaignStatus.QUEUE_FAILED,
            errorMessage: `Materialização divergente: esperado=${preview.eligibleContacts}, obtido=${contacts.length}`,
          },
        });
        throw new AppError(
          `Divergência na materialização: esperado=${preview.eligibleContacts}, obtido=${contacts.length}.`,
          409,
        );
      }

      if (contacts.length === 0) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: CampaignStatus.QUEUE_FAILED, errorMessage: 'Audiência vazia após materialização.' },
        });
        throw new AppError('Campanha vazia após materialização.', 422);
      }

      // Persist recipients
      const recipientRows = contacts.map((c) => ({
        id: `${campaign.id}:${c.id}`,
        campaignId: campaign.id,
        contactId: c.id,
        phoneNumber: c.phoneNumber,
        contactName: c.name,
        status: CampaignRecipientStatus.PENDING,
      }));

      for (let i = 0; i < recipientRows.length; i += batchSize) {
        const slice = recipientRows.slice(i, i + batchSize);
        await prisma.campaignRecipient.createMany({ data: slice, skipDuplicates: true });
      }

      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          materializedRecipients: contacts.length,
          pendingCount: contacts.length,
        },
      });

      // Enqueue BullMQ jobs in batches (batch size ≠ total limit)
      let queuedJobs = 0;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const slice = contacts.slice(i, i + batchSize);
        const bulk = slice.map((c) => ({
          name: BROADCAST_QUEUE_NAME,
          data: {
            campaignId: campaign.id,
            draftId: draftId!,
            userId,
            imagePath,
            delayMs: Math.round(input.delaySeconds * 1000),
            contact: { id: c.id, phoneNumber: c.phoneNumber, name: c.name },
            // legacy field kept empty for old processor paths
            contacts: [] as Array<{ id: number; phoneNumber: string; name: string }>,
          },
          opts: {
            jobId: `${campaign.id}:${c.id}`,
            attempts: 3,
            backoff: { type: 'exponential' as const, delay: 60000 },
            removeOnComplete: 1000,
            removeOnFail: 2000,
          },
        }));

        const added = await broadcastQueue.addBulk(bulk);
        queuedJobs += added.length;

        await prisma.campaignRecipient.updateMany({
          where: {
            campaignId: campaign.id,
            contactId: { in: slice.map((c) => c.id) },
          },
          data: { status: CampaignRecipientStatus.QUEUED },
        });
      }

      if (queuedJobs === 0) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: CampaignStatus.QUEUE_FAILED, errorMessage: 'queuedJobs=0' },
        });
        throw new AppError('Falha ao enfileirar: queuedJobs=0.', 500);
      }

      const updated = await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: CampaignStatus.QUEUED,
          queuedJobs,
          pendingCount: queuedJobs,
        },
      });

      campaignEventBus.emitCampaign({
        type: 'campaign.queued',
        campaignId: campaign.id,
        userId,
        payload: {
          queuedJobs,
          expectedRecipients: updated.expectedRecipients,
          materializedRecipients: updated.materializedRecipients,
          status: updated.status,
        },
        at: new Date().toISOString(),
      });

      logger.info(
        `[campaign]: queued campaign=${campaign.id} jobs=${queuedJobs} expected=${preview.eligibleContacts}`,
      );

      return {
        campaignId: campaign.id,
        batchId: campaign.id,
        expectedRecipients: updated.expectedRecipients,
        materializedRecipients: updated.materializedRecipients,
        queuedJobs,
        skippedAlreadySent: preview.alreadySentContacts,
        status: updated.status,
        batchSize,
        estimatedBatches: Math.ceil(queuedJobs / batchSize),
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: CampaignStatus.QUEUE_FAILED, errorMessage: message },
      });
      campaignEventBus.emitCampaign({
        type: 'campaign.queue_failed',
        campaignId: campaign.id,
        userId,
        payload: { error: message },
        at: new Date().toISOString(),
      });
      throw err;
    }
  }

  async materializeAudience(userId: number, input: AudiencePreviewInput): Promise<Contact[]> {
    const excludedSet = new Set((input.excludedIds || []).map(Number).filter(Number.isFinite));
    const rows = await this.resolveEligibleContacts(userId, input, { includeInvalid: false });
    let eligible = rows.filter((c) => !excludedSet.has(c.id));

    if (input.skipAlreadySent !== false && input.draftId) {
      const sentPhones = await feedHistoryService.getSentPhoneNumbersForDraft(userId, input.draftId);
      eligible = eligible.filter((c) => !sentPhones.has(c.phoneNumber));
    }
    return eligible;
  }

  async getProgress(userId: number, campaignId: string) {
    const campaign = await this.getOwnedCampaign(userId, campaignId);
    const counts = await prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

    const queued = (byStatus.QUEUED || 0) + (byStatus.PENDING || 0);
    const active = byStatus.ACTIVE || 0;
    const sent = (byStatus.SENT || 0) + (byStatus.DELIVERED || 0);
    const failed = byStatus.FAILED || 0;
    const skipped = byStatus.SKIPPED || 0;
    const cancelled = byStatus.CANCELLED || 0;
    const total = campaign.materializedRecipients || campaign.expectedRecipients;
    const processed = sent + failed + skipped + cancelled;
    const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

    return {
      campaignId: campaign.id,
      batchId: campaign.id,
      title: campaign.title,
      status: campaign.status,
      expectedRecipients: campaign.expectedRecipients,
      materializedRecipients: campaign.materializedRecipients,
      queuedJobs: campaign.queuedJobs,
      counters: {
        queued,
        active,
        sent,
        failed,
        skipped,
        cancelled,
        pending: queued,
        processed,
        total,
      },
      progressPercent,
      delayMs: campaign.delayMs,
      batchSize: campaign.batchSize,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      errorMessage: campaign.errorMessage,
    };
  }

  async listJobs(userId: number, campaignId: string, page = 1, limit = 50) {
    await this.getOwnedCampaign(userId, campaignId);
    const take = Math.min(100, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const [data, total] = await prisma.$transaction([
      prisma.campaignRecipient.findMany({
        where: { campaignId },
        orderBy: { contactId: 'asc' },
        skip,
        take,
      }),
      prisma.campaignRecipient.count({ where: { campaignId } }),
    ]);
    return {
      data: data.map((r) => ({
        id: r.id,
        contactId: r.contactId,
        recipientName: r.contactName,
        recipientPhone: r.phoneNumber,
        status: r.status,
        attempts: r.attempts,
        error: r.errorMessage || undefined,
        sentAt: r.sentAt,
      })),
      total,
      page,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take) || 1),
    };
  }

  async listHistory(userId: number, page = 1, limit = 20) {
    const take = Math.min(50, Math.max(1, limit));
    const skip = (Math.max(1, page) - 1) * take;
    const [data, total] = await prisma.$transaction([
      prisma.campaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.campaign.count({ where: { userId } }),
    ]);

    return {
      data: data.map((c) => this.toHistoryItem(c)),
      total,
      page,
      limit: take,
      totalPages: Math.max(1, Math.ceil(total / take) || 1),
      monthLabel: new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    };
  }

  async getActiveCampaign(userId: number): Promise<Campaign | null> {
    return prisma.campaign.findFirst({
      where: {
        userId,
        status: { in: [CampaignStatus.PREPARING, CampaignStatus.QUEUED, CampaignStatus.RUNNING, CampaignStatus.PAUSED] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pause(userId: number, campaignId: string): Promise<Campaign> {
    const campaign = await this.getOwnedCampaign(userId, campaignId);
    if (campaign.status !== CampaignStatus.QUEUED && campaign.status !== CampaignStatus.RUNNING) {
      throw new AppError('Campanha não pode ser pausada neste status.', 409);
    }
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.PAUSED },
    });
    campaignEventBus.emitCampaign({
      type: 'campaign.paused',
      campaignId,
      userId,
      payload: { status: updated.status },
      at: new Date().toISOString(),
    });
    return updated;
  }

  async resume(userId: number, campaignId: string): Promise<Campaign> {
    const campaign = await this.getOwnedCampaign(userId, campaignId);
    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new AppError('Campanha não está pausada.', 409);
    }
    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.QUEUED },
    });
    campaignEventBus.emitCampaign({
      type: 'campaign.resumed',
      campaignId,
      userId,
      payload: { status: updated.status },
      at: new Date().toISOString(),
    });
    return updated;
  }

  async cancel(userId: number, campaignId: string): Promise<Campaign> {
    const campaign = await this.getOwnedCampaign(userId, campaignId);
    if (
      campaign.status === CampaignStatus.COMPLETED ||
      campaign.status === CampaignStatus.CANCELLED ||
      campaign.status === CampaignStatus.FAILED
    ) {
      throw new AppError('Campanha já finalizada.', 409);
    }

    // Remove waiting/delayed jobs for this campaign
    try {
      const waiting = await broadcastQueue.getWaiting();
      const delayed = await broadcastQueue.getDelayed();
      for (const job of [...waiting, ...delayed]) {
        if (job.data?.campaignId === campaignId && job.data?.userId === userId) {
          await job.remove();
        }
      }
    } catch (err) {
      logger.error(`[campaign]: cancel queue cleanup failed: ${(err as Error).message}`);
    }

    await prisma.campaignRecipient.updateMany({
      where: {
        campaignId,
        status: { in: [CampaignRecipientStatus.PENDING, CampaignRecipientStatus.QUEUED] },
      },
      data: { status: CampaignRecipientStatus.CANCELLED },
    });

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.CANCELLED, completedAt: new Date() },
    });

    campaignEventBus.emitCampaign({
      type: 'campaign.cancelled',
      campaignId,
      userId,
      payload: { status: updated.status },
      at: new Date().toISOString(),
    });
    return updated;
  }

  /** Worker hooks */
  async markRecipientActive(campaignId: string, contactId: number): Promise<void> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;
    if (campaign.status === CampaignStatus.PAUSED || campaign.status === CampaignStatus.CANCELLED) {
      throw new AppError(`Campaign ${campaignId} is ${campaign.status}`, 409);
    }
    if (campaign.status === CampaignStatus.QUEUED) {
      await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.RUNNING, startedAt: campaign.startedAt || new Date() },
      });
      campaignEventBus.emitCampaign({
        type: 'campaign.running',
        campaignId,
        userId: campaign.userId,
        payload: { status: CampaignStatus.RUNNING },
        at: new Date().toISOString(),
      });
    }
    await prisma.campaignRecipient.updateMany({
      where: { id: `${campaignId}:${contactId}` },
      data: { status: CampaignRecipientStatus.ACTIVE, attempts: { increment: 1 } },
    });
  }

  async markRecipientResult(
    campaignId: string,
    contactId: number,
    result: 'SENT' | 'FAILED' | 'SKIPPED',
    errorMessage?: string,
  ): Promise<void> {
    const status =
      result === 'SENT'
        ? CampaignRecipientStatus.SENT
        : result === 'SKIPPED'
          ? CampaignRecipientStatus.SKIPPED
          : CampaignRecipientStatus.FAILED;

    await prisma.campaignRecipient.updateMany({
      where: { id: `${campaignId}:${contactId}` },
      data: {
        status,
        errorMessage: errorMessage || null,
        sentAt: result === 'SENT' ? new Date() : undefined,
      },
    });

    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;

    const data: Prisma.CampaignUpdateInput = {};
    if (result === 'SENT') data.sentCount = { increment: 1 };
    if (result === 'FAILED') data.failedCount = { increment: 1 };
    if (result === 'SKIPPED') data.skippedCount = { increment: 1 };
    data.pendingCount = { decrement: 1 };

    await prisma.campaign.update({ where: { id: campaignId }, data });

    campaignEventBus.emitCampaign({
      type: 'campaign.recipient',
      campaignId,
      userId: campaign.userId,
      payload: { contactId, result, errorMessage },
      at: new Date().toISOString(),
    });

    await this.recomputeTerminalStatus(campaignId);
  }

  async recomputeTerminalStatus(campaignId: string): Promise<void> {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;
    if (campaign.status === CampaignStatus.CANCELLED || campaign.status === CampaignStatus.PAUSED) return;

    const pending = await prisma.campaignRecipient.count({
      where: {
        campaignId,
        status: {
          in: [
            CampaignRecipientStatus.PENDING,
            CampaignRecipientStatus.QUEUED,
            CampaignRecipientStatus.ACTIVE,
          ],
        },
      },
    });
    if (pending > 0) return;

    const failed = await prisma.campaignRecipient.count({
      where: { campaignId, status: CampaignRecipientStatus.FAILED },
    });
    const sent = await prisma.campaignRecipient.count({
      where: { campaignId, status: { in: [CampaignRecipientStatus.SENT, CampaignRecipientStatus.DELIVERED] } },
    });

    let status: CampaignStatus = CampaignStatus.COMPLETED;
    if (failed > 0 && sent > 0) status = CampaignStatus.PARTIAL_FAILED;
    else if (failed > 0 && sent === 0) status = CampaignStatus.FAILED;

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status, completedAt: new Date(), pendingCount: 0 },
    });

    campaignEventBus.emitCampaign({
      type: 'campaign.finished',
      campaignId,
      userId: campaign.userId,
      payload: { status, sent, failed },
      at: new Date().toISOString(),
    });
  }

  private async getOwnedCampaign(userId: number, campaignId: string): Promise<Campaign> {
    const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, userId } });
    if (!campaign) throw new AppError('Campanha não encontrada.', 404);
    return campaign;
  }

  private toHistoryItem(c: Campaign) {
    const processed = c.sentCount + c.failedCount + c.skippedCount;
    const total = c.materializedRecipients || c.expectedRecipients || 1;
    const successRate = total > 0 ? `${Math.round((c.sentCount / total) * 100)}%` : '0%';
    return {
      id: c.id,
      date: c.createdAt.toISOString(),
      title: c.title,
      totalContacts: c.materializedRecipients || c.expectedRecipients,
      successRate,
      deliveredCount: c.sentCount + c.deliveredCount,
      failedCount: c.failedCount,
      queuedJobs: c.queuedJobs,
      status: c.status,
      duration: c.completedAt && c.startedAt
        ? `${Math.max(1, Math.round((c.completedAt.getTime() - c.startedAt.getTime()) / 60000))} min`
        : '—',
      processed,
    };
  }
}

export default new CampaignService();
