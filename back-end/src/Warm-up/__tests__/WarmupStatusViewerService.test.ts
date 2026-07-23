import { WarmupStatusViewerService } from '../services/WarmupStatusViewerService';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupQueue } from '../queues/WarmupQueue';
import { proto } from '@whiskeysockets/baileys';
import { WarmupStatus } from '@prisma/client';

jest.mock('../services/WarmupProfileService', () => ({
  WarmupProfileService: {
    getProfile: jest.fn(),
  }
}));

jest.mock('../queues/WarmupQueue', () => ({
  WarmupQueue: {
    addStatusJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
  }
}));

describe('WarmupStatusViewerService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSocket = {} as any;
  const mockMessage = {
    key: {
      remoteJid: 'status@broadcast',
      participant: '123@s.whatsapp.net',
      id: 'msg-1'
    }
  } as proto.IWebMessageInfo;

  it('should ignore status if profile is not in RUNNING state', async () => {
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValue(null);

    await WarmupStatusViewerService.handleIncomingStatus('inst-1', mockMessage, mockSocket);

    expect(WarmupQueue.addStatusJob).not.toHaveBeenCalled();
  });

  it('should ignore status occasionally based on probability (simulating 30% ignore)', async () => {
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValue({ status: WarmupStatus.WARMING });
    jest.spyOn(Math, 'random').mockReturnValue(0.8); // 80% > 70% threshold (ignored)

    await WarmupStatusViewerService.handleIncomingStatus('inst-2', mockMessage, mockSocket);

    expect(WarmupQueue.addStatusJob).not.toHaveBeenCalled();
  });

  it('should queue status view with a jitter delay based on probability (70% hit)', async () => {
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValue({ status: WarmupStatus.WARMING });
    
    // Force random to 0.5 for probability and 0.5 for jitter (max - min) / 2 + min
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    await WarmupStatusViewerService.handleIncomingStatus('inst-3', mockMessage, mockSocket);

    expect(WarmupQueue.addStatusJob).toHaveBeenCalledWith(
      {
        instanceId: 'inst-3',
        messageKey: mockMessage.key,
      },
      expect.any(Number) // Check that it passes a numeric delay
    );
  });
});
