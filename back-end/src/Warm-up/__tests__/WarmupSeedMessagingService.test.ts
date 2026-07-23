import { WarmupSeedMessagingService } from '../services/WarmupSeedMessagingService';
import { WarmupProfileService } from '../services/WarmupProfileService';
import { WarmupSeedContactService } from '../services/WarmupSeedContactService';
import { WarmupQueue } from '../queues/WarmupQueue';
import { WarmupBaileysService } from '../services/WarmupBaileysService';
import { toWhatsAppJid } from '../../utils/phoneUtils';
import LlamaService from '../../services/LlamaService';
import { WarmupCacheService } from '../services/WarmupCacheService';

jest.mock('@whiskeysockets/baileys', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
  makeWASocket: jest.fn(),
}));

jest.mock('../services/WarmupProfileService');
jest.mock('../services/WarmupSeedContactService');
jest.mock('../queues/WarmupQueue');
jest.mock('../services/WarmupBaileysService');
jest.mock('../../services/LlamaService');
jest.mock('../services/WarmupCacheService');
jest.mock('../services/WarmupTypoService', () => ({
  WarmupTypoService: {
    generateTypo: jest.fn((text: string) => ({ text, correction: undefined })),
    shouldDelete: jest.fn(() => false)
  }
}));

describe('WarmupSeedMessagingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (WarmupCacheService.appendConversationHistory as jest.Mock).mockResolvedValue(undefined);
  });

  describe('scheduleSeedMessages', () => {
    it('should schedule seed messages using Round-Robin spatial distribution', async () => {
      // Mock 3 profiles to test Round-Robin Math
      jest.spyOn(WarmupProfileService, 'getActiveProfiles').mockResolvedValue([
        { instanceId: 1, name: 'Profile 1', currentPhase: 'PHASE_1', status: 'WARMING', dailyLimit: 10, messagesSentToday: 0, startDate: new Date(), createdAt: new Date(), updatedAt: new Date(), id: 1 },
        { instanceId: 2, name: 'Profile 2', currentPhase: 'PHASE_1', status: 'WARMING', dailyLimit: 10, messagesSentToday: 0, startDate: new Date(), createdAt: new Date(), updatedAt: new Date(), id: 2 },
        { instanceId: 3, name: 'Profile 3', currentPhase: 'PHASE_1', status: 'WARMING', dailyLimit: 10, messagesSentToday: 0, startDate: new Date(), createdAt: new Date(), updatedAt: new Date(), id: 3 },
      ]);

      jest.spyOn(WarmupSeedContactService, 'listSeedContacts').mockResolvedValue([
        { id: 1, profileId: 1, phoneNumber: '5511999999999', name: 'Test', createdAt: new Date() }
      ]);

      const addSeedMessageJobSpy = jest.spyOn(WarmupQueue, 'addSeedMessageJob').mockResolvedValue(undefined as any);

      // Force Math.random() to return 0.5 consistently for predictable test results
      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      await WarmupSeedMessagingService.scheduleSeedMessages();

      expect(addSeedMessageJobSpy).toHaveBeenCalledTimes(3);
      
      // Profiles.length = 3
      // windowMs = 50 * 60 * 1000 = 3000000
      // intervalMs = 1000000 (16.66 mins)
      // slotStartMs[0] = 5 mins + 0
      // Math.random = 0.5 -> offset = (1000000 * 0.1) + (1000000 * 0.8 * 0.5) = 100000 + 400000 = 500000
      // delay[0] = 5 * 60 * 1000 + 500000 = 300000 + 500000 = 800000
      // slotStartMs[1] = 5 mins + 1000000 = 1300000. delay[1] = 1300000 + 500000 = 1800000
      // slotStartMs[2] = 5 mins + 2000000 = 2300000. delay[2] = 2300000 + 500000 = 2800000

      // The delayMs arguments passed to the queue should be exactly these, but because array is shuffled with Math.random() = 0.5, order of instances might be unchanged
      // We just need to check if the calls are made with delays 800000, 1800000, 2800000 in ANY order

      const delays = addSeedMessageJobSpy.mock.calls.map(call => call[1]).sort((a, b) => (a || 0) - (b || 0));
      expect(delays[0]).toBe(800000);
      expect(delays[1]).toBe(1800000);
      expect(delays[2]).toBe(2800000);

      mathRandomSpy.mockRestore();
    });

    it('should gracefully handle errors when scheduling', async () => {
      (WarmupProfileService.getActiveProfiles as jest.Mock).mockRejectedValue(new Error('DB Error'));
      await expect(WarmupSeedMessagingService.scheduleSeedMessages()).resolves.not.toThrow();
    });
  });

  describe('executeSeedMessage', () => {
    it('should send a generated AI question and log success', async () => {
      const mockSocket = {} as any;
      (LlamaService.generateCompletion as jest.Mock).mockResolvedValue('"Olá, tudo bem com você?"');

      await WarmupSeedMessagingService.executeSeedMessage(mockSocket, 'inst-1', '5511999999999');

      expect(WarmupBaileysService.sendWarmupMessage).toHaveBeenCalledWith(
        mockSocket,
        toWhatsAppJid('5511999999999'),
        'Olá, tudo bem com você?'
      );
    });

    it('should fallback to static questions if AI generation fails', async () => {
      const mockSocket = {} as any;
      (LlamaService.generateCompletion as jest.Mock).mockRejectedValue(new Error('AI Failed'));
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // Picks "Tudo bem por aí?"

      await WarmupSeedMessagingService.executeSeedMessage(mockSocket, 'inst-1', '5511999999999');

      expect(WarmupBaileysService.sendWarmupMessage).toHaveBeenCalledWith(
        mockSocket,
        toWhatsAppJid('5511999999999'),
        'Tudo bem por aí?'
      );
    });
  });
});
