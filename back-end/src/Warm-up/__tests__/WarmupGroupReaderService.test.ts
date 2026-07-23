import { WarmupGroupReaderService } from '../services/WarmupGroupReaderService';
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
    addGroupReadJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
  }
}));

describe('WarmupGroupReaderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockSocket = {} as any;
  const mockMessage = {
    key: {
      remoteJid: '123456789-987654321@g.us',
      participant: '123@s.whatsapp.net',
      id: 'msg-group-1'
    }
  } as proto.IWebMessageInfo;

  it('should ignore if the remoteJid does not end with @g.us', async () => {
    const invalidMessage = { key: { remoteJid: 'user@s.whatsapp.net' } } as proto.IWebMessageInfo;
    await WarmupGroupReaderService.handleIncomingGroupMessage('inst-1', invalidMessage, mockSocket);
    expect(WarmupProfileService.getProfile).not.toHaveBeenCalled();
  });

  it('should ignore group message if profile is not in WARMING state', async () => {
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValue(null);

    await WarmupGroupReaderService.handleIncomingGroupMessage('inst-1', mockMessage, mockSocket);

    expect(WarmupQueue.addGroupReadJob).not.toHaveBeenCalled();
  });

  it('should ignore group message occasionally based on probability (simulating 60% ignore)', async () => {
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValue({ status: WarmupStatus.WARMING });
    jest.spyOn(Math, 'random').mockReturnValue(0.7); // 70% > 40% threshold (ignored)

    await WarmupGroupReaderService.handleIncomingGroupMessage('inst-2', mockMessage, mockSocket);

    expect(WarmupQueue.addGroupReadJob).not.toHaveBeenCalled();
  });

  it('should queue group read with a jitter delay based on probability (40% hit)', async () => {
    (WarmupProfileService.getProfile as jest.Mock).mockResolvedValue({ status: WarmupStatus.WARMING });
    
    // Force random to 0.2 for probability (hit) and 0.5 for jitter
    jest.spyOn(Math, 'random').mockReturnValue(0.2);

    await WarmupGroupReaderService.handleIncomingGroupMessage('inst-3', mockMessage, mockSocket);

    expect(WarmupQueue.addGroupReadJob).toHaveBeenCalledWith(
      {
        instanceId: 'inst-3',
        messageKey: mockMessage.key,
      },
      expect.any(Number) // Check that it passes a numeric delay
    );
  });
});
