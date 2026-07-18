jest.mock('../../services/WhatsAppInstanceManager', () => ({
  __esModule: true,
  default: {
    getInstancesForUser: jest.fn(),
  }
}));
jest.mock('../../utils/redisClient', () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    quit: jest.fn()
  }
}));
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on: jest.fn()
  })),
  Queue: jest.fn()
}));
jest.mock('../../services/DraftService');
jest.mock('../../services/FeedHistoryService');
jest.mock('../../services/ContactService');

import { broadcastProcessor } from '../broadcastQueue';
import draftService from '../../services/DraftService';
import whatsAppInstanceManager from '../../services/WhatsAppInstanceManager';
import feedHistoryService from '../../services/FeedHistoryService';
import contactService from '../../services/ContactService';
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
          { id: 11, phoneNumber: '5511999990002', name: 'Jane Doe' }
        ]
      },
      updateProgress: jest.fn().mockResolvedValue(true),
      updateData: jest.fn().mockResolvedValue(true),
    };

    (draftService.getDraftById as jest.Mock).mockResolvedValue({
      id: 1,
      status: 'APPROVED',
      generatedContent: { titulo: 'Test', resumo: 'Test', fonte: 'Test' }
    });

    (feedHistoryService.logMessage as jest.Mock).mockResolvedValue({
      _id: new Types.ObjectId().toString()
    });

    const mockInstance = {
      getInstanceId: jest.fn().mockReturnValue(1),
      sendMessage: jest.fn().mockResolvedValue('msg-id-123'),
      getStatus: jest.fn().mockReturnValue({ state: 'open' })
    };

    (whatsAppInstanceManager.getInstancesForUser as jest.Mock).mockReturnValue([mockInstance]);
  });

  it('should process contacts and send messages successfully', async () => {
    const result = await broadcastProcessor(mockJob as Job);

    const mockInstance = whatsAppInstanceManager.getInstancesForUser(1)[0];
    expect(result.successCount).toBe(2);
    expect(mockInstance.sendMessage).toHaveBeenCalledTimes(2);
    expect(feedHistoryService.updateMessageStatus).toHaveBeenCalledWith(
      expect.any(String),
      'sent',
      undefined,
      'msg-id-123'
    );
  });

  it('should halt if draft is cancelled mid-flight', async () => {
    (draftService.getDraftById as jest.Mock)
      .mockResolvedValueOnce({ status: 'APPROVED', generatedContent: {} }) // outside loop
      .mockResolvedValueOnce({ status: 'APPROVED', generatedContent: {} }) // loop 1
      .mockResolvedValueOnce({ status: 'CANCELLED' }); // loop 2

    const result = await broadcastProcessor(mockJob as Job);

    const mockInstance = whatsAppInstanceManager.getInstancesForUser(1)[0];
    expect(result.successCount).toBe(1);
    expect(mockInstance.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('should slice and throw error on timeout/network issue (Retry Logic)', async () => {
    const mockInstance = whatsAppInstanceManager.getInstancesForUser(1)[0];
    (mockInstance.sendMessage as jest.Mock)
      .mockResolvedValueOnce('msg-id-123') // first contact succeeds
      .mockRejectedValueOnce({ statusCode: 504, message: 'timeout' }); // second contact times out

    await expect(broadcastProcessor(mockJob as Job)).rejects.toMatchObject({ statusCode: 504 });

    // Job data should be updated with the remaining contacts (slice from failed contact index)
    expect(mockJob.updateData).toHaveBeenCalledWith(expect.objectContaining({
      contacts: [
        { id: 11, phoneNumber: '5511999990002', name: 'Jane Doe' }
      ]
    }));
  });

  it('should deactivate contact on 404 / Not Registered error', async () => {
    const mockInstance = whatsAppInstanceManager.getInstancesForUser(1)[0];
    (mockInstance.sendMessage as jest.Mock).mockRejectedValueOnce({ statusCode: 404, message: 'not registered' });

    const result = await broadcastProcessor(mockJob as Job);

    // Continue processing other contacts
    expect(result.successCount).toBe(1);
    expect(contactService.update).toHaveBeenCalledWith(10, 1, { active: false });
    expect(feedHistoryService.updateMessageStatus).toHaveBeenCalledWith(
      expect.any(String),
      'failed',
      'invalid_number'
    );
  });
});
