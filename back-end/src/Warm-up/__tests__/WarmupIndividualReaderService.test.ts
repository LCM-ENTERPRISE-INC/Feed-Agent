import { WarmupIndividualReaderService } from '../services/WarmupIndividualReaderService';
import { WarmupQueue } from '../queues/WarmupQueue';

jest.mock('../queues/WarmupQueue');
jest.mock('../utils/warmupLogger', () => ({
  warmupLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('WarmupIndividualReaderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleIncomingMessage', () => {
    const mockSocket = {} as any;

    it('should ignore messages sent by the bot itself', async () => {
      const msg: any = {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: true
        }
      };

      await WarmupIndividualReaderService.handleIncomingMessage('inst-1', msg, mockSocket);
      expect(WarmupQueue.addIndividualReadJob).not.toHaveBeenCalled();
    });

    it('should ignore messages from status@broadcast', async () => {
      const msg: any = {
        key: {
          remoteJid: 'status@broadcast',
          fromMe: false
        }
      };

      await WarmupIndividualReaderService.handleIncomingMessage('inst-1', msg, mockSocket);
      expect(WarmupQueue.addIndividualReadJob).not.toHaveBeenCalled();
    });

    it('should ignore messages from groups', async () => {
      const msg: any = {
        key: {
          remoteJid: '123456789@g.us',
          fromMe: false
        }
      };

      await WarmupIndividualReaderService.handleIncomingMessage('inst-1', msg, mockSocket);
      expect(WarmupQueue.addIndividualReadJob).not.toHaveBeenCalled();
    });

    it('should enqueue individual_read job with a jitter for DMs', async () => {
      const msg: any = {
        key: {
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false
        }
      };

      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      await WarmupIndividualReaderService.handleIncomingMessage('inst-1', msg, mockSocket);

      expect(WarmupQueue.addIndividualReadJob).toHaveBeenCalledTimes(1);
      
      // Delay should be exactly halfway between 15s (15000) and 3m (180000)
      // (180000 - 15000) * 0.5 + 15000 = 82500 + 15000 = 97500ms
      expect(WarmupQueue.addIndividualReadJob).toHaveBeenCalledWith({
        instanceId: 'inst-1',
        messageKey: msg.key
      }, 97500);
    });
  });
});
