jest.mock('../../queues/broadcastQueue', () => ({
  BROADCAST_QUEUE_NAME: 'broadcast-processing-queue',
  broadcastQueue: {
    addBulk: jest.fn(),
    getWaiting: jest.fn().mockResolvedValue([]),
    getDelayed: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../services/WhatsAppInstanceManager', () => ({
  __esModule: true,
  default: { getInstancesForUser: jest.fn() },
}));

jest.mock('../../services/FeedHistoryService', () => ({
  __esModule: true,
  default: { getSentPhoneNumbersForDraft: jest.fn().mockResolvedValue(new Set()) },
}));

jest.mock('../../models/prismaClient', () => ({
  __esModule: true,
  default: {
    contact: { count: jest.fn(), findMany: jest.fn() },
    draft: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    campaign: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    campaignRecipient: {
      createMany: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '../../models/prismaClient';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import feedHistoryService from '../../services/FeedHistoryService';
import { broadcastQueue } from '../../queues/broadcastQueue';
import campaignService, { DEFAULT_BROADCAST_BATCH_SIZE } from '../CampaignService';

function contact(id: number, phone = `5511999${String(id).padStart(6, '0')}`) {
  return {
    id,
    userId: 1,
    phoneNumber: phone,
    name: `C${id}`,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('CampaignService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (whatsAppInstanceManager.getInstancesForUser as jest.Mock).mockReturnValue([
      { getStatus: () => ({ state: 'open' }) },
    ]);
    (feedHistoryService.getSentPhoneNumbersForDraft as jest.Mock).mockResolvedValue(new Set());
    (broadcastQueue.getWaiting as jest.Mock).mockResolvedValue([]);
    (broadcastQueue.getDelayed as jest.Mock).mockResolvedValue([]);
  });

  describe('previewAudience', () => {
    it('returns 678 eligible and 6 batches for batchSize 125', async () => {
      const rows = Array.from({ length: 678 }, (_, i) => contact(i + 1));
      (prisma.contact.count as jest.Mock)
        .mockResolvedValueOnce(678)
        .mockResolvedValueOnce(678)
        .mockResolvedValueOnce(0);
      (prisma.contact.findMany as jest.Mock).mockResolvedValue(rows);

      const preview = await campaignService.previewAudience(1, { selectionMode: 'all' });
      expect(preview.totalContacts).toBe(678);
      expect(preview.eligibleContacts).toBe(678);
      expect(preview.batchSize).toBe(DEFAULT_BROADCAST_BATCH_SIZE);
      expect(preview.estimatedBatches).toBe(Math.ceil(678 / DEFAULT_BROADCAST_BATCH_SIZE));
    });

    it('excludes invalid phones from eligible', async () => {
      (prisma.contact.count as jest.Mock)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0);
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([
        contact(1),
        { ...contact(2), phoneNumber: '123' },
      ]);

      const preview = await campaignService.previewAudience(1, { selectionMode: 'all' });
      expect(preview.eligibleContacts).toBe(1);
      expect(preview.invalidContacts).toBe(1);
    });

    it('scopes findMany by userId', async () => {
      (prisma.contact.count as jest.Mock).mockResolvedValue(0);
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
      await campaignService.previewAudience(99, { selectionMode: 'all' });
      expect(prisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 99 }) }),
      );
    });
  });

  describe('createAndEnqueue', () => {
    it('queues 126 contacts as two batches (125+1) with deterministic jobIds', async () => {
      const rows = Array.from({ length: 126 }, (_, i) => contact(i + 1));
      (prisma.contact.count as jest.Mock).mockResolvedValue(126);
      (prisma.contact.findMany as jest.Mock).mockResolvedValue(rows);
      (prisma.draft.findMany as jest.Mock).mockResolvedValue([
        { id: 7, userId: 1, status: 'APPROVED', generatedContent: { titulo: 'T' }, imagePath: null },
      ]);
      (prisma.campaign.create as jest.Mock).mockResolvedValue({ id: 'camp-126', userId: 1, expectedRecipients: 126 });
      (prisma.campaign.update as jest.Mock).mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'camp-126',
        expectedRecipients: 126,
        materializedRecipients: 126,
        queuedJobs: 126,
        status: data.status || 'QUEUED',
      }));
      (prisma.campaignRecipient.createMany as jest.Mock).mockResolvedValue({ count: 126 });
      (prisma.campaignRecipient.updateMany as jest.Mock).mockResolvedValue({ count: 126 });
      (broadcastQueue.addBulk as jest.Mock)
        .mockResolvedValueOnce(Array.from({ length: 125 }, (_, i) => ({ id: `j${i}` })))
        .mockResolvedValueOnce([{ id: 'j-last' }]);

      const result = await campaignService.createAndEnqueue(1, {
        selectionMode: 'all',
        delaySeconds: 3,
        batchSize: 125,
      });

      expect(result.queuedJobs).toBe(126);
      expect(result.expectedRecipients).toBe(126);
      expect(broadcastQueue.addBulk).toHaveBeenCalledTimes(2);
      const firstBulk = (broadcastQueue.addBulk as jest.Mock).mock.calls[0][0];
      expect(firstBulk).toHaveLength(125);
      expect(firstBulk[0].opts.jobId).toBe('camp-126:1');
    });

    it('rejects empty audience with 422', async () => {
      (prisma.contact.count as jest.Mock).mockResolvedValue(0);
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.draft.findMany as jest.Mock).mockResolvedValue([
        { id: 1, status: 'APPROVED', generatedContent: {}, imagePath: null },
      ]);
      await expect(
        campaignService.createAndEnqueue(1, { selectionMode: 'all', delaySeconds: 2 }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it('rejects disconnected channel with 409', async () => {
      (whatsAppInstanceManager.getInstancesForUser as jest.Mock).mockReturnValue([]);
      await expect(
        campaignService.createAndEnqueue(1, { selectionMode: 'all', delaySeconds: 2 }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('blocks expectedRecipients divergence with 409', async () => {
      (prisma.contact.count as jest.Mock).mockResolvedValue(2);
      (prisma.contact.findMany as jest.Mock).mockResolvedValue([contact(1), contact(2)]);
      (prisma.draft.findMany as jest.Mock).mockResolvedValue([
        { id: 1, status: 'APPROVED', generatedContent: {}, imagePath: null },
      ]);
      await expect(
        campaignService.createAndEnqueue(1, {
          selectionMode: 'all',
          delaySeconds: 2,
          expectedRecipients: 999,
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });
});
