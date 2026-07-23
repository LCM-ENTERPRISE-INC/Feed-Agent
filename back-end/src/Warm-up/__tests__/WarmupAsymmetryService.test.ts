import { WarmupAsymmetryService } from '../services/WarmupAsymmetryService';
import { WarmupCacheService } from '../services/WarmupCacheService';

jest.mock('../services/WarmupCacheService');

describe('WarmupAsymmetryService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateAndBlockIfNeeded', () => {
    it('should return true if there is no state', async () => {
      (WarmupCacheService.getState as jest.Mock).mockResolvedValue(null);
      const result = await WarmupAsymmetryService.evaluateAndBlockIfNeeded('inst-1');
      expect(result).toBe(true);
    });

    it('should return false if instance is already paused', async () => {
      (WarmupCacheService.getState as jest.Mock).mockResolvedValue({
        isPaused: true,
        messagesSentInCurrentBatch: 5,
        messagesReceivedInCurrentBatch: 0
      });
      const result = await WarmupAsymmetryService.evaluateAndBlockIfNeeded('inst-1');
      expect(result).toBe(false);
    });

    it('should return true if ratio is acceptable', async () => {
      (WarmupCacheService.getState as jest.Mock).mockResolvedValue({
        isPaused: false,
        messagesSentInCurrentBatch: 9,
        messagesReceivedInCurrentBatch: 0
      });
      const result = await WarmupAsymmetryService.evaluateAndBlockIfNeeded('inst-1');
      expect(result).toBe(true);
    });

    it('should return false and pause if ratio >= 10:1', async () => {
      (WarmupCacheService.getState as jest.Mock).mockResolvedValue({
        isPaused: false,
        messagesSentInCurrentBatch: 10,
        messagesReceivedInCurrentBatch: 0
      });
      
      const result = await WarmupAsymmetryService.evaluateAndBlockIfNeeded('inst-1');
      
      expect(result).toBe(false);
      expect(WarmupCacheService.setState).toHaveBeenCalledWith('inst-1', {
        isPaused: true,
        messagesSentInCurrentBatch: 10,
        messagesReceivedInCurrentBatch: 0
      });
    });

    it('should calculate ratio correctly when received > 0', async () => {
      (WarmupCacheService.getState as jest.Mock).mockResolvedValue({
        isPaused: false,
        messagesSentInCurrentBatch: 25,
        messagesReceivedInCurrentBatch: 2
      });
      // 25 / 2 = 12.5 (>= 10)
      const result = await WarmupAsymmetryService.evaluateAndBlockIfNeeded('inst-1');
      expect(result).toBe(false);
    });

    it('should pass if received > 0 and ratio is < 10', async () => {
      (WarmupCacheService.getState as jest.Mock).mockResolvedValue({
        isPaused: false,
        messagesSentInCurrentBatch: 25,
        messagesReceivedInCurrentBatch: 3
      });
      // 25 / 3 = 8.33 (< 10)
      const result = await WarmupAsymmetryService.evaluateAndBlockIfNeeded('inst-1');
      expect(result).toBe(true);
    });
  });
});
