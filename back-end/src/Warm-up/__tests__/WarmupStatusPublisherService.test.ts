import { WarmupStatusPublisherService } from '../services/WarmupStatusPublisherService';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupQueue } from '../queues/WarmupQueue';
import axios from 'axios';

jest.mock('../services/WarmupProfileService', () => ({
  WarmupProfileService: {
    getActiveProfiles: jest.fn(),
  }
}));

jest.mock('../queues/WarmupQueue', () => ({
  WarmupQueue: {
    addStatusPostJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
  }
}));

jest.mock('axios');

describe('WarmupStatusPublisherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleMorningStatuses', () => {
    it('should query active profiles and schedule a job for each with a jitter', async () => {
      (WarmupProfileService.getActiveProfiles as jest.Mock).mockResolvedValue([
        { instanceId: 101 },
        { instanceId: 102 }
      ]);
      
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Predictable jitter

      await WarmupStatusPublisherService.scheduleMorningStatuses();

      expect(WarmupProfileService.getActiveProfiles).toHaveBeenCalled();
      
      // Jitter math: (45-5)=40m * 0.5 = 20m + 5m = 25m = 1500000ms
      expect(WarmupQueue.addStatusPostJob).toHaveBeenCalledWith(
        { instanceId: '101' },
        1500000
      );
      expect(WarmupQueue.addStatusPostJob).toHaveBeenCalledWith(
        { instanceId: '102' },
        1500000
      );
      expect(WarmupQueue.addStatusPostJob).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully without crashing', async () => {
      (WarmupProfileService.getActiveProfiles as jest.Mock).mockRejectedValue(new Error('DB Error'));

      await expect(WarmupStatusPublisherService.scheduleMorningStatuses()).resolves.not.toThrow();
    });
  });

  describe('executeStatusPost', () => {
    const mockSocket = {
      sendMessage: jest.fn().mockResolvedValue({}),
    } as any;

    it('should fetch an image and send it as a status broadcast', async () => {
      (axios.get as jest.Mock).mockResolvedValue({ data: Buffer.from('fake-image-data') });
      jest.spyOn(Math, 'random').mockReturnValue(0); // Select first caption "Bom dia! ☀️"

      await WarmupStatusPublisherService.executeStatusPost(mockSocket, 'inst-1');

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('picsum.photos'),
        { responseType: 'arraybuffer' }
      );

      expect(mockSocket.sendMessage).toHaveBeenCalledWith(
        'status@broadcast',
        {
          image: expect.any(Buffer),
          caption: 'Bom dia! ☀️'
        }
      );
    });
  });
});
