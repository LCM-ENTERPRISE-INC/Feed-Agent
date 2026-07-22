jest.mock('../../services/WhatsAppInstanceManager', () => ({
  __esModule: true,
  default: {
    getInstancesForUser: jest.fn(),
  },
}));
jest.mock('../../utils/redisClient', () => ({
  __esModule: true,
  default: { on: jest.fn(), quit: jest.fn() },
}));
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
  Queue: jest.fn(),
}));
jest.mock('../../services/DraftService');
jest.mock('../../services/FeedHistoryService');
jest.mock('../../services/ContactService');
jest.mock('../../services/CampaignService', () => ({
  __esModule: true,
  default: {
    markRecipientActive: jest.fn(),
    markRecipientResult: jest.fn(),
  },
}));
jest.mock('../../models/prismaClient', () => ({
  __esModule: true,
  default: {
    campaign: { findFirst: jest.fn() },
  },
}));

import { broadcastProcessor } from '../broadcastQueue';
import draftService from '../../services/DraftService';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import feedHistoryService from '../../services/FeedHistoryService';
import contactService from '../../services/ContactService';
import campaignService from '../../services/CampaignService';
import prisma from '../../models/prismaClient';
import { Job } from 'bullmq';
import { Types } from 'mongoose';

describe('BroadcastQueue', () => {
  let mockJob: Partial<Job>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJob = {
      id: 'job-123',
      data: {
        draftId: 1,
        userId: 1,
        contacts: [
          { id: 10, phoneNumber: '5511999990001', name: 'John Doe' },
          { id: 11, phoneNumber: '5511999990002', name: 'Jane Doe' },
        ],
      },
      updateProgress: jest.fn().mockResolvedValue(true),
      updateData: jest.fn().mockResolvedValue(true),
    };

    (draftService.getDraftById as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'APPROVED',
      generatedContent: { titulo: 'Test', resumo: 'Test', fonte: 'Test' },
    });

    (feedHistoryService.logMessage as jest.Mock).mockResolvedValue({
      _id: new Types.ObjectId().toString(),
    });

    const mockInstance = {
      getInstanceId: jest.fn().mockReturnValue(1),
      sendMessage: jest.fn().mockResolvedValue('msg-id-123'),
      getStatus: jest.fn().mockReturnValue({ state: 'open' }),
    };

    (whatsAppInstanceManager.getInstancesForUser as jest.Mock).mockReturnValue([mockInstance]);
  });

  it('should process contacts and send messages successfully', async () => {
    const result = await broadcastProcessor(mockJob as Job);
    const mockInstance = whatsAppInstanceManager.getInstancesForUser(1)[0];
    expect(result.successCount).toBe(2);
    expect(mockInstance.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('should halt if draft is cancelled mid-flight', async () => {
    (draftService.getDraftById as jest.Mock)
      .mockResolvedValueOnce({ status: 'APPROVED', generatedContent: {} })
      .mockResolvedValueOnce({ status: 'APPROVED', generatedContent: {} })
      .mockResolvedValueOnce({ status: 'CANCELLED' });

    const result = await broadcastProcessor(mockJob as Job);
    const mockInstance = whatsAppInstanceManager.getInstancesForUser(1)[0];
    expect(result.successCount).toBe(1);
    expect(mockInstance.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('should mark failed and continue on timeout (legacy multi-contact)', async () => {
    const mockInstance = whatsAppInstanceManager.getInstancesForUser(1)[0];
    (mockInstance.sendMessage as jest.Mock)
      .mockResolvedValueOnce('msg-id-123')
      .mockRejectedValueOnce({ statusCode: 504, message: 'timeout' });

    const result = await broadcastProcessor(mockJob as Job);
    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(1);
  });

  it('should deactivate contact on 404 / Not Registered error', async () => {
    const mockInstance = whatsAppInstanceManager.getInstancesForUser(1)[0];
    (mockInstance.sendMessage as jest.Mock)
      .mockRejectedValueOnce({ statusCode: 404, message: 'not registered' })
      .mockResolvedValueOnce('msg-id-123');

    const result = await broadcastProcessor(mockJob as Job);
    expect(contactService.update).toHaveBeenCalled();
    expect(result.failCount).toBe(1);
    expect(result.successCount).toBe(1);
  });

  it('should process single-contact campaign job with deterministic tracking', async () => {
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
      id: 'camp1',
      userId: 1,
      status: 'QUEUED',
    });

    mockJob.data = {
      campaignId: 'camp1',
      draftId: 1,
      userId: 1,
      contact: { id: 10, phoneNumber: '5511999990001', name: 'John' },
      contacts: [],
      delayMs: 1000,
    };

    const result = await broadcastProcessor(mockJob as Job);
    expect(campaignService.markRecipientActive).toHaveBeenCalledWith('camp1', 10);
    expect(campaignService.markRecipientResult).toHaveBeenCalledWith('camp1', 10, 'SENT', undefined);
    expect(result).toEqual({ result: 'SENT' });
  });
});
